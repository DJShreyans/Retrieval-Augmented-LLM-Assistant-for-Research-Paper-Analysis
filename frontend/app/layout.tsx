import "./globals.css";
import React from "react";
import AppShellWrapper from "@/components/AppShellWrapper";

export const metadata = {
  title: "ResearchMate | AI Research Assistant",
  description: "Understand Research Papers in Minutes, Not Hours",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen">
        <AppShellWrapper>{children}</AppShellWrapper>
      </body>
    </html>
  );
}
