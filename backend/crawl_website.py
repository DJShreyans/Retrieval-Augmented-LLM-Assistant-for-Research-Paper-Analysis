"""
crawl_website.py
Bulk crawls all pages and PDFs from vit.edu.in sitemaps, indexes them in ChromaDB,
and registers them in documents_metadata.json so they appear in the UI.
Usage:
  python crawl_website.py [--limit N] [--force]
"""
import os
import sys
import argparse
import requests
import re
import io
import time
from bs4 import BeautifulSoup
import fitz  # PyMuPDF
from datetime import datetime

# Add current directory to path to locate app modules
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.rag import collection, split_text_into_chunks
from app.main import load_metadata, save_metadata

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    )
}

SITEMAP_INDEX = "https://vit.edu.in/sitemap_index.xml"

def get_all_sitemap_urls(index_url: str) -> list[str]:
    """Parses sitemap index and returns all sub-sitemaps."""
    sitemaps = []
    try:
        resp = requests.get(index_url, headers=HEADERS, timeout=15)
        if resp.status_code != 200:
            print(f"[Crawler] Failed to fetch sitemap index: Status {resp.status_code}")
            return []
        
        soup = BeautifulSoup(resp.content, "xml")
        for loc in soup.find_all("loc"):
            url = loc.get_text().strip()
            if url:
                sitemaps.append(url)
    except Exception as e:
        print(f"[Crawler] Error fetching sitemap index: {e}")
    return sitemaps

def get_urls_from_sitemap(sitemap_url: str) -> list[str]:
    """Parses a single sitemap XML and extracts all loc URLs."""
    urls = []
    try:
        resp = requests.get(sitemap_url, headers=HEADERS, timeout=15)
        if resp.status_code != 200:
            print(f"[Crawler] Failed to fetch sitemap {sitemap_url}: Status {resp.status_code}")
            return []
        
        soup = BeautifulSoup(resp.content, "xml")
        for loc in soup.find_all("loc"):
            url = loc.get_text().strip()
            if url:
                urls.append(url)
    except Exception as e:
        print(f"[Crawler] Error fetching sitemap {sitemap_url}: {e}")
    return urls

def clean_html_text(html_content: str) -> str:
    """Extracts visible body text from HTML, stripping boilerplate components."""
    try:
        soup = BeautifulSoup(html_content, "html.parser")
        
        # Decompose layout & interactive tags
        for tag in soup(["script", "style", "nav", "footer", "header", "noscript", 
                         "iframe", "form", "button", "meta", "aside", "head"]):
            tag.decompose()
            
        text = soup.get_text(separator=" ", strip=True)
        text = re.sub(r'\s+', ' ', text).strip()
        return text
    except Exception as e:
        print(f"[Crawler] HTML parsing error: {e}")
        return ""

def scrape_pdf_text(url: str, timeout: int = 20) -> str:
    """Downloads a PDF document and extracts full text content using PyMuPDF."""
    try:
        resp = requests.get(url, headers=HEADERS, timeout=timeout, stream=True)
        if resp.status_code != 200:
            return ""
        pdf_bytes = io.BytesIO(resp.content)
        text = ""
        with fitz.open(stream=pdf_bytes, filetype="pdf") as doc:
            for page in doc:
                text += page.get_text() + "\n"
        text = re.sub(r'\s+', ' ', text).strip()
        return text
    except Exception as e:
        print(f"[Crawler] PDF extraction failed: {e}")
        return ""

def scrape_url_content(url: str) -> dict:
    """Scrapes content from URL and returns visible text along with the page title."""
    if url.lower().endswith(".pdf"):
        return {"title": url.split("/")[-1], "text": scrape_pdf_text(url)}
        
    try:
        resp = requests.get(url, headers=HEADERS, timeout=12)
        if resp.status_code != 200:
            return {"title": url, "text": ""}
        
        content_type = resp.headers.get("Content-Type", "")
        if "application/pdf" in content_type:
            return {"title": url.split("/")[-1], "text": scrape_pdf_text(url)}
            
        soup = BeautifulSoup(resp.text, "html.parser")
        title = soup.title.string.strip() if (soup.title and soup.title.string) else url
        cleaned_text = clean_html_text(resp.text)
        
        return {"title": title, "text": cleaned_text}
    except Exception as e:
        print(f"[Crawler] Scrape failed for {url}: {e}")
        return {"title": url, "text": ""}

def main():
    parser = argparse.ArgumentParser(description="VIT Website Comprehensive Crawler")
    parser.add_argument("--limit", type=int, default=0, help="Limit number of URLs to crawl")
    parser.add_argument("--force", action="store_true", help="Force re-crawl of already indexed URLs")
    args = parser.parse_args()

    print("==================================================")
    print("      ResearchMate - VIT College Web Crawler      ")
    print("==================================================")

    # 1. Fetch sub-sitemaps
    print(f"Fetching sitemap index from {SITEMAP_INDEX}...")
    sitemaps = get_all_sitemap_urls(SITEMAP_INDEX)
    if not sitemaps:
        print("[ERROR] Could not retrieve sitemap list.")
        return
    print(f"Found {len(sitemaps)} sitemaps.")

    # 2. Collect unique URLs
    all_urls = []
    for sitemap in sitemaps:
        print(f"Parsing sitemap: {sitemap.split('/')[-1]}...")
        urls = get_urls_from_sitemap(sitemap)
        all_urls.extend(urls)

    # Deduplicate and sort
    all_urls = sorted(list(set(all_urls)))
    print(f"\nTotal unique URLs discovered: {len(all_urls)}")

    # Load existing metadata list
    metadata = load_metadata()
    indexed_urls = set(item["filename"] for item in metadata if item.get("source_type") == "url")
    print(f"Already indexed website resources in metadata list: {len(indexed_urls)}")

    # 3. Limit crawl count if requested
    if args.limit > 0:
        all_urls = all_urls[:args.limit]
        print(f"Test mode: Limiting crawl to first {args.limit} pages.")

    # 4. Filter pending URLs
    urls_to_crawl = []
    for url in all_urls:
        # Filter static files
        if url.lower().endswith(('.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.css', '.js', '.woff', '.woff2', '.ttf')):
            continue
        if url in indexed_urls and not args.force:
            continue
        urls_to_crawl.append(url)

    total_crawl = len(urls_to_crawl)
    print(f"Starting crawl for {total_crawl} pending pages (Skipping already indexed)...\n")

    success_count = 0
    failed_count = 0
    total_chunks = 0

    for idx, url in enumerate(urls_to_crawl, 1):
        print(f"[{idx}/{total_crawl}] Crawling: {url}...")
        try:
            res = scrape_url_content(url)
            title = res["title"]
            text = res["text"]

            if not text or len(text.strip()) < 80:
                print(f"  -> [WARNING] Empty or too short content extracted.")
                failed_count += 1
                continue

            chunks = split_text_into_chunks(text)
            if not chunks:
                print(f"  -> [WARNING] Splitting resulted in 0 chunks.")
                failed_count += 1
                continue

            # Ingest chunks into ChromaDB under source = url
            ids = [f"{url}_chunk_{i}" for i in range(len(chunks))]
            chunk_metas = [{"source": url, "chunk_index": i} for i in range(len(chunks))]
            
            collection.add(
                ids=ids,
                documents=chunks,
                metadatas=chunk_metas
            )

            # Register in documents_metadata.json
            metadata = [item for item in metadata if item["filename"] != url]
            
            size_mb = round(len(text) / (1024 * 1024), 4)
            creation_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            
            metadata.append({
                "filename": url,
                "size_mb": size_mb if size_mb > 0.01 else 0.01,
                "uploaded_at": creation_time,
                "type": "url",
                "source_type": "url",
                "title": title
            })
            save_metadata(metadata)

            print(f"  -> [OK] Indexed successfully ({len(chunks)} chunks, title: '{title}')")
            success_count += 1
            total_chunks += len(chunks)

            # Standard polite delay
            time.sleep(0.5)

        except Exception as e:
            print(f"  -> [ERROR] Failed to crawl: {e}")
            failed_count += 1

    print("\n==================================================")
    print("                Crawl Summary                     ")
    print("==================================================")
    print(f"Total Pages Discovered: {len(all_urls)}")
    print(f"Already Indexed:        {len(indexed_urls)}")
    print(f"Successfully Crawled:   {success_count}")
    print(f"Failed/Skipped:         {failed_count}")
    print(f"Total Chunks Vectorized: {total_chunks}")
    print("==================================================")

if __name__ == "__main__":
    main()
