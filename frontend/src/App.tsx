import { Routes, Route, Navigate } from "react-router-dom";
import { Layout } from "./components/Layout";
import { LibraryPage } from "./pages/Library";
import { FileDetailPage } from "./pages/FileDetail";
import { ChatPage } from "./pages/Chat";
import { ConflictsPage } from "./pages/Conflicts";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<LibraryPage />} />
        <Route path="/files/:id" element={<FileDetailPage />} />
        <Route path="/chat" element={<ChatPage />} />
        <Route path="/conflicts" element={<ConflictsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
