import "./globals.css";

export const metadata = {
  title: "Vectra",
  description: "Slicer-style plotting workflow"
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <div className="app-shell">
          <header className="top-bar">
            <div className="brand">Vectra</div>
            <div className="actions">Import | New | Save | Undo | Redo | Export</div>
          </header>
          <div className="main">
            <aside className="sidebar left">
              <div className="panel-title">Project</div>
              <div className="panel-body">Files, pages, layers</div>
            </aside>
            <main className="canvas">
              {children}
            </main>
            <aside className="sidebar right">
              <div className="panel-title">Parameters</div>
              <div className="panel-body">Tabs: Document, Vectorize, Cleanup...</div>
            </aside>
          </div>
          <footer className="bottom-bar">Cursor: 0,0 | Zoom 100% | ETA: --</footer>
        </div>
      </body>
    </html>
  );
}
