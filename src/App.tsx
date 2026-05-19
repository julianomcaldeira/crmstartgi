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
import EmailDashboard from "./pages/EmailDashboard";
import Relatorios from "./pages/Relatorios";
import Admin from "./pages/Admin";
import AdminImport from "./pages/AdminImport";
import Feiras from "./pages/Feiras";
import MetricasEquipe from "./pages/MetricasEquipe";
import RadarLeads from "./pages/RadarLeads";
import InteligenciaMercado from "./pages/InteligenciaMercado";
import PreVendas from "./pages/PreVendas";
import Propostas from "./pages/Propostas";
import PropostasComerciais from "./pages/PropostasComerciais";
import PropostaPublica from "./pages/PropostaPublica";
import PropostaInsights from "./pages/PropostaInsights";
import Contratos from "./pages/Contratos";
import ContratoDetalhes from "./pages/ContratoDetalhes";
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
        <Route path="/prospect/:id" element={<Layout><ProspectDetalhes /></Layout>} />
        <Route path="/oportunidades" element={<Layout><Oportunidades /></Layout>} />
        <Route path="/clientes" element={<Layout><Clientes /></Layout>} />
        <Route path="/clientes/:id" element={<Layout><ProspectDetalhes /></Layout>} />
        <Route path="/tarefas" element={<Layout><Tarefas /></Layout>} />
        <Route path="/metas" element={<Layout><Metas /></Layout>} />
        <Route path="/relatorios" element={<Layout><Relatorios /></Layout>} />
        <Route path="/base-conhecimento" element={<Layout><BaseConhecimento /></Layout>} />
        <Route path="/processo-vendas" element={<Layout><ProcessoVendas /></Layout>} />
        <Route path="/admin" element={<Layout><Admin /></Layout>} />
        <Route path="/importacao" element={<Layout><AdminImport /></Layout>} />
        <Route path="/feiras" element={<Layout><Feiras /></Layout>} />
        <Route path="/metricas-equipe" element={<Layout><MetricasEquipe /></Layout>} />
        <Route path="/radar-leads" element={<Layout><RadarLeads /></Layout>} />
        <Route path="/inteligencia-mercado" element={<Layout><InteligenciaMercado /></Layout>} />
        <Route path="/pre-vendas" element={<Layout><PreVendas /></Layout>} />
        <Route path="/propostas" element={<Layout><Propostas /></Layout>} />
        <Route path="/propostas/comerciais" element={<Layout><PropostasComerciais /></Layout>} />
        <Route path="/propostas/comerciais/:id" element={<Layout><PropostasComerciais /></Layout>} />
        <Route path="/propostas/:id/insights" element={<Layout><PropostaInsights /></Layout>} />
        <Route path="/contratos" element={<Layout><Contratos /></Layout>} />
        <Route path="/contratos/:id" element={<Layout><ContratoDetalhes /></Layout>} />
        <Route path="/p/:token" element={<PropostaPublica />} />
        <Route path="/configuracoes" element={<Layout><Configuracoes /></Layout>} />
        <Route path="/emails-dashboard" element={<Layout><EmailDashboard /></Layout>} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
