import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Prospects from "./pages/Prospects";
import ProspectDetalhes from "./pages/ProspectDetalhes";
import BaseConhecimento from "./pages/BaseConhecimento";
import ProcessoVendas from "./pages/ProcessoVendas";
import Clientes from "./pages/Clientes";
import Oportunidades from "./pages/Oportunidades";
import Tarefas from "./pages/Tarefas";
import Metas from "./pages/Metas";
import Configuracoes from "./pages/Configuracoes";
import Agenda from "./pages/Agenda";
import Relatorios from "./pages/Relatorios";
import Admin from "./pages/Admin";
import Feiras from "./pages/Feiras";
import PerformanceVendedores from "./pages/PerformanceVendedores";
import MetricasEquipe from "./pages/MetricasEquipe";
import Layout from "./components/Layout";
import NotFound from "./pages/NotFound";

const App = () => {
  return (
    <BrowserRouter>
      <Toaster />
      <Sonner />
      <Routes>
        <Route path="/auth" element={<Auth />} />
        <Route path="/" element={<Layout><Dashboard /></Layout>} />
        <Route path="/prospects" element={<Layout><Prospects /></Layout>} />
        <Route path="/prospects/:id" element={<Layout><ProspectDetalhes /></Layout>} />
        <Route path="/oportunidades" element={<Layout><Oportunidades /></Layout>} />
        <Route path="/clientes" element={<Layout><Clientes /></Layout>} />
        <Route path="/tarefas" element={<Layout><Tarefas /></Layout>} />
        <Route path="/metas" element={<Layout><Metas /></Layout>} />
        <Route path="/relatorios" element={<Layout><Relatorios /></Layout>} />
        <Route path="/agenda" element={<Layout><Agenda /></Layout>} />
        <Route path="/base-conhecimento" element={<Layout><BaseConhecimento /></Layout>} />
        <Route path="/processo-vendas" element={<Layout><ProcessoVendas /></Layout>} />
        <Route path="/admin" element={<Layout><Admin /></Layout>} />
        <Route path="/feiras" element={<Layout><Feiras /></Layout>} />
        <Route path="/performance" element={<Layout><PerformanceVendedores /></Layout>} />
        <Route path="/metricas-equipe" element={<Layout><MetricasEquipe /></Layout>} />
        <Route path="/configuracoes" element={<Layout><Configuracoes /></Layout>} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
