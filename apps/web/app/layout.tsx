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
            <div className="brand-wrap">
              <div className="brand">Vectra</div>
              <div className="brand-subtitle">Plotter Slicer Workspace</div>
            </div>
            <div className="actions">
              <button className="toolbar-btn">Import</button>
              <button className="toolbar-btn">New</button>
              <button className="toolbar-btn">Save</button>
              <button className="toolbar-btn">Undo</button>
              <button className="toolbar-btn">Redo</button>
              <button className="toolbar-btn primary">Export</button>
            </div>
          </header>
          <div className="main">
            <aside className="sidebar left">
              <div className="panel-title">Project</div>
              <div id="project-root" className="project-root" />
            </aside>
            <main className="canvas">
              {children}
            </main>
            <aside className="sidebar right">
              <div className="panel-title">Parameters</div>
              <div className="inspector-tabs">
                <span className="inspector-chip active">Document</span>
                <span className="inspector-chip">Vectorize</span>
                <span className="inspector-chip">Optimization</span>
                <span className="inspector-chip">Machine</span>
                <span className="inspector-chip">Output</span>
              </div>
              <div id="inspector-root" className="inspector-root" />
            </aside>
          </div>
          <footer className="bottom-bar">
            <div id="bottom-bar-root" className="bottom-bar-root" />
          </footer>
        </div>
      </body>
    </html>
  );
}
