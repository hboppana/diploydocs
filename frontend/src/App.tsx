import { Routes, Route, Navigate } from "react-router-dom";
import { Layout } from "./components/Layout";
import { LibraryPage } from "./pages/Library";
import { FileDetailPage } from "./pages/FileDetail";
import { ComposeDocPage } from "./pages/ComposeDoc";
import { ChatPage } from "./pages/Chat";
import { ConflictsPage } from "./pages/Conflicts";
import { EmbeddingMapPage } from "./pages/EmbeddingMap";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<LibraryPage />} />
        <Route path="/new" element={<ComposeDocPage />} />
        <Route path="/files/:id/edit" element={<ComposeDocPage />} />
        <Route path="/files/:id" element={<FileDetailPage />} />
        <Route path="/chat" element={<ChatPage />} />
        <Route path="/conflicts" element={<ConflictsPage />} />
        <Route path="/embeddings" element={<EmbeddingMapPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
