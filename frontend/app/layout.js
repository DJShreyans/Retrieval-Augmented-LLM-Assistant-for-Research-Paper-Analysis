import "./globals.css";
import Sidebar from "../components/Sidebar";

export const metadata = {
  title: "ResearchMate - AI Research Paper Assistant",
  description: "Local Retrieval-Augmented Generation (RAG) assistant for PDF and Word documents.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="dark h-full">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="flex h-screen w-screen overflow-hidden bg-darkBg text-gray-100 font-sans antialiased">
        {/* Sidebar Nav */}
        <Sidebar />
        
        {/* Page Content Container */}
        <main className="flex-1 flex flex-col h-full min-w-0 overflow-y-auto bg-[#080B13] relative">
          {/* Subtle background ambient glowing elements for premium layout */}
          <div className="absolute top-0 right-0 w-[40rem] h-[40rem] rounded-full bg-indigo-500/5 blur-[120px] pointer-events-none -z-10"></div>
          <div className="absolute bottom-0 left-0 w-[30rem] h-[30rem] rounded-full bg-emerald-500/5 blur-[100px] pointer-events-none -z-10"></div>
          
          <div className="flex-1 flex flex-col p-8 z-10 max-w-[1600px] mx-auto w-full">
            {children}
          </div>
        </main>
      </body>
    </html>
  );
}
