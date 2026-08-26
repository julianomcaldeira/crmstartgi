import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { AuthProvider } from "@/contexts/AuthContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import Layout from "./components/Layout";
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
import NotFound from "./pages/NotFound";
import Unsubscribe from "./pages/Unsubscribe";

const App = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <Routes>
          <Route path="/auth" element={<ErrorBoundary><Auth /></ErrorBoundary>} />
          <Route path="/" element={<ErrorBoundary><Layout><Dashboard /></Layout></ErrorBoundary>} />
          <Route path="/prospects" element={<ErrorBoundary><Layout><Prospects /></Layout></ErrorBoundary>} />
          <Route path="/prospects/:id" element={<ErrorBoundary><Layout><ProspectDetalhes /></Layout></ErrorBoundary>} />
          <Route path="/oportunidades" element={<ErrorBoundary><Layout><Oportunidades /></Layout></ErrorBoundary>} />
          <Route path="/clientes" element={<ErrorBoundary><Layout><Clientes /></Layout></ErrorBoundary>} />
          <Route path="/clientes/:id" element={<ErrorBoundary><Layout><ProspectDetalhes /></Layout></ErrorBoundary>} />
          <Route path="/tarefas" element={<ErrorBoundary><Layout><Tarefas /></Layout></ErrorBoundary>} />
          <Route path="/metas" element={<ErrorBoundary><Layout><Metas /></Layout></ErrorBoundary>} />
          <Route path="/relatorios" element={<ErrorBoundary><Layout><Relatorios /></Layout></ErrorBoundary>} />
          <Route path="/base-conhecimento" element={<ErrorBoundary><Layout><BaseConhecimento /></Layout></ErrorBoundary>} />
          <Route path="/processo-vendas" element={<ErrorBoundary><Layout><ProcessoVendas /></Layout></ErrorBoundary>} />
          <Route path="/admin" element={<ErrorBoundary><Layout><Admin /></Layout></ErrorBoundary>} />
          <Route path="/importacao" element={<ErrorBoundary><Layout><AdminImport /></Layout></ErrorBoundary>} />
          <Route path="/feiras" element={<ErrorBoundary><Layout><Feiras /></Layout></ErrorBoundary>} />
          <Route path="/metricas-equipe" element={<ErrorBoundary><Layout><MetricasEquipe /></Layout></ErrorBoundary>} />
          <Route path="/radar-leads" element={<ErrorBoundary><Layout><RadarLeads /></Layout></ErrorBoundary>} />
          <Route path="/inteligencia-mercado" element={<ErrorBoundary><Layout><InteligenciaMercado /></Layout></ErrorBoundary>} />
          <Route path="/pre-vendas" element={<ErrorBoundary><Layout><PreVendas /></Layout></ErrorBoundary>} />
          <Route path="/propostas" element={<ErrorBoundary><Layout><Propostas /></Layout></ErrorBoundary>} />
          <Route path="/propostas/comerciais" element={<ErrorBoundary><Layout><PropostasComerciais /></Layout></ErrorBoundary>} />
          <Route path="/propostas/comerciais/:id" element={<ErrorBoundary><Layout><PropostasComerciais /></Layout></ErrorBoundary>} />
          <Route path="/propostas/:id/insights" element={<ErrorBoundary><Layout><PropostaInsights /></Layout></ErrorBoundary>} />
          <Route path="/contratos" element={<ErrorBoundary><Layout><Contratos /></Layout></ErrorBoundary>} />
          <Route path="/contratos/:id" element={<ErrorBoundary><Layout><ContratoDetalhes /></Layout></ErrorBoundary>} />
          <Route path="/p/:token" element={<ErrorBoundary><PropostaPublica /></ErrorBoundary>} />
          <Route path="/unsubscribe" element={<ErrorBoundary><Unsubscribe /></ErrorBoundary>} />
          <Route path="/configuracoes" element={<ErrorBoundary><Layout><Configuracoes /></Layout></ErrorBoundary>} />
          <Route path="/emails-dashboard" element={<ErrorBoundary><Layout><EmailDashboard /></Layout></ErrorBoundary>} />
          <Route path="*" element={<ErrorBoundary><NotFound /></ErrorBoundary>} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;
