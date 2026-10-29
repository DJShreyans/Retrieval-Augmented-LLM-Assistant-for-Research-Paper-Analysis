# ResearchMate 5-Minute Live Demo Walkthrough & Demo Script

This script provides an exact 5-minute walkthrough of **ResearchMate**, highlighting its strict citation grounding, hybrid retrieval speed, and rule-based comparison engine.

---

## 1. Eight Core Demo Questions

These 8 questions have been verified against the indexed corpus (`data/corpus.db` and `data/faiss/index.faiss`) to demonstrate high-accuracy retrieval and page-anchored evidence cards:

| # | Demo Question | Target Paper | Paper ID & Page | Expected Evidence / Answer |
|---|---|---|---|---|
| **1** | *"What is defensive boosting and how does it prevent calibration degradation in online forecasting?"* | *Defensive Boosting for Online Probabilistic Forecasting* | **Paper #3**, Page 1 | Combines probabilistic online forecasting with defensive forecasting to guarantee well-calibrated predictions without sacrificing empirical sharpness. |
| **2** | *"How does the online metric TSP algorithm break the classical $O(n)$ competitive ratio barrier?"* | *Online Metric TSP: Beyond the $O(n)$ Barrier* | **Paper #2**, Page 1 | Employs adaptive re-routing strategies and geometric partitioning to surpass the previously established competitive ratio lower bounds. |
| **3** | *"What graph coloring algorithm is proposed for external labeling in paged geophylogenies?"* | *Paged Geophylogenies: A Coloring Approach to External Labeling...* | **Paper #1**, Page 1 | Formulates the external labeling problem with tree constraints as a graph coloring problem on paged layouts to eliminate crossing edge artifacts. |
| **4** | *"How does adaptive work filtering accelerate sparse-matrix permanent estimation?"* | *The Quick and the Dead: Estimating Sparse-Matrix Permanents...* | **Paper #4**, Page 1 | Prunes unpromising computational trajectories early via bounded variance estimation, accelerating permanent calculations by orders of magnitude. |
| **5** | *"What are T-Robinson spaces and how are they recognized in empirical data?"* | *T-Robinson Spaces: Structure, Recognition, and Applications...* | **Paper #5**, Page 1 | Generalizes classical Robinson dissimilarity matrices to tree structures, providing polynomial-time recognition algorithms for phylogenetic data. |
| **6** | *"Under what graph conditions is bidirectional Dijkstra instance-optimal?"* | *Instance-Optimality of Bidirectional Dijkstra on Simple Graphs* | **Paper #7**, Page 1 | Proves instance optimality on simple, undirected graphs under balanced vertex degree and non-negative edge weight conditions. |
| **7** | *"How are loose time windows handled in the time-dependent traveling salesman problem?"* | *The Time-Dependent Traveling Salesman Problem with Loose Time Windows* | **Paper #10**, Page 1 | Formulates dynamic programming state space reductions with bounding relaxations tailored to loose arrival time intervals. |
| **8** | *"How does shared traversal optimize batch genotype graph editing?"* | *Cheaper by the Batch: Shared Traversal for Genotype Graph Editing* | **Paper #12**, Page 1 | Amortizes pan-genome graph traversal costs by batching concurrent edit operations across shared sequence paths. |

---

## 2. Five-Minute Live Demo Flow

### Minute 0:00 – 1:00: Landing & Secure Authentication
1. Open browser to `http://localhost:3000`.
2. **Show Landing Page**: Note the clean indigo design palette (`#3525CD`), hero message, and feature cards (Upload, Smart Summaries, Q&A, Compare, Reviews, Gaps).
3. Click **Sign In**:
   - Showcase **Email/Password** login (`admin@researchmate.local` / `AdminSecretPass123!`).
   - Highlight the **Continue with Google** button for OAuth 2.0 single-sign on.
4. Once authenticated, point out the user greeting and session cookies configured in `HttpOnly` mode.

### Minute 1:00 – 2:00: My Library & Split-Screen Viewer
1. Click **My Library** in the sidebar.
2. **Show Card Grid**:
   - Real thumbnails generated from Page 1 of each PDF via PyMuPDF.
   - Filter by topic tags (e.g. *"Algorithms & Data Structures"*, *"Graph Theory"*).
   - Toggle between **Card View** and **List View**.
3. Click into **Paper #3** (*Defensive Boosting...*):
   - Opens the **Split-Screen Paper Viewer**.
   - Left panel: High-resolution PDF document with zoom, page navigation, and text selection.
   - Right panel: **Auto-Generated Structured Summary** with Key Contributions, Methodology, Datasets, and Limitations—each displaying verbatim quotes and page badges.

### Minute 2:00 – 3:00: Cited Chat & Hybrid Retrieval
1. Navigate to **Chat** in the sidebar.
2. Demonstrate the **Scope Toggle**:
   - Switch between **"All papers (library)"** and **"This paper"**.
3. Input Demo Question #1:
   > *"What is defensive boosting and how does it prevent calibration degradation in online forecasting?"*
4. **Observe the Stream**:
   - Sub-50ms hybrid retrieval combines SQLite FTS5 (BM25) and FAISS vector similarity via RRF.
   - In free extractive mode (`LLM_PROVIDER=none`), returns numbered **Top Evidence Cards**.
   - In LLM mode, streams grounded prose with inline `[1]` citation chips.
5. Click a citation chip:
   - Opens the **Source Citation Inspector** side drawer showing the exact document, year, page number, and source quote.
   - Click **"Jump to Page"** to navigate directly to the citation page in the viewer.

### Minute 3:00 – 4:00: Structured Comparison Matrix
1. Click **Comparison** in the sidebar.
2. Select 3 related papers (e.g., Papers #1, #2, and #3).
3. Click **Generate Comparison**:
   - Displays the **Aspect Comparison Matrix**: Method, Task, Dataset, Metric, Value, Conditions.
4. **Demonstrate Grounding & Rule-Based Comparability**:
   - Hover over any metric cell: a popover displays the **exact source passage and page number**.
   - Point out the **"Directly Comparable Benchmarks"** section vs the **"Not Directly Comparable"** section, which explicitly flags differences in metrics, units, or hardware.
5. Click **Export CSV** to download the auditable comparison sheet.

### Minute 4:00 – 5:00: Lit Review, Gaps, Ideas & Settings
1. Click **Lit Review**:
   - Enter topic: *"Online routing and metric optimization"*.
   - View synthesized thematic sections with `[n]` citations and inspect the **Coverage Log** (queries run, passages analyzed, papers included).
2. Click **Research Gaps**:
   - Review clustered candidate research gaps flagged as *"Hypotheses for expert review"*.
3. Click **Ideas**:
   - View an AI-generated study outline designed around an identified research gap.
4. Click **Settings**:
   - Review live hardware telemetry (CPU cores, RAM usage, CUDA GPU status).
   - Point out that API keys are strictly masked (`••••••••`), ensuring zero credential leakage.
