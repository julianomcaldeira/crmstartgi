import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Clientes from "./pages/Clientes";
import ClienteDetalhes from "./pages/ClienteDetalhes";
import Oportunidades from "./pages/Oportunidades";
import Tarefas from "./pages/Tarefas";
import Metas from "./pages/Metas";
import Relatorios from "./pages/Relatorios";
import Admin from "./pages/Admin";
import Layout from "./components/Layout";
import NotFound from "./pages/NotFound";

const App = () => {
  return (
    <>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/auth" element={<Auth />} />
          <Route path="/" element={<Layout><Dashboard /></Layout>} />
          <Route path="/clientes" element={<Layout><Clientes /></Layout>} />
          <Route path="/clientes/:id" element={<Layout><ClienteDetalhes /></Layout>} />
          <Route path="/oportunidades" element={<Layout><Oportunidades /></Layout>} />
          <Route path="/tarefas" element={<Layout><Tarefas /></Layout>} />
          <Route path="/metas" element={<Layout><Metas /></Layout>} />
          <Route path="/relatorios" element={<Layout><Relatorios /></Layout>} />
          <Route path="/admin" element={<Layout><Admin /></Layout>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </>
  );
};

export default App;
