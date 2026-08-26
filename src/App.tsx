import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { AuthProvider } from "@/contexts/AuthContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import Layout from "./components/Layout";

const Auth = lazy(() => import("./pages/Auth"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Prospects = lazy(() => import("./pages/Prospects"));
const ProspectDetalhes = lazy(() => import("./pages/ProspectDetalhes"));
const BaseConhecimento = lazy(() => import("./pages/BaseConhecimento"));
const ProcessoVendas = lazy(() => import("./pages/ProcessoVendas"));
const Clientes = lazy(() => import("./pages/Clientes"));
const Oportunidades = lazy(() => import("./pages/Oportunidades"));
const Tarefas = lazy(() => import("./pages/Tarefas"));
const Metas = lazy(() => import("./pages/Metas"));
const Configuracoes = lazy(() => import("./pages/Configuracoes"));
const EmailDashboard = lazy(() => import("./pages/EmailDashboard"));
const Relatorios = lazy(() => import("./pages/Relatorios"));
const Admin = lazy(() => import("./pages/Admin"));
const AdminImport = lazy(() => import("./pages/AdminImport"));
const Feiras = lazy(() => import("./pages/Feiras"));
const MetricasEquipe = lazy(() => import("./pages/MetricasEquipe"));
const RadarLeads = lazy(() => import("./pages/RadarLeads"));
const InteligenciaMercado = lazy(() => import("./pages/InteligenciaMercado"));
const PreVendas = lazy(() => import("./pages/PreVendas"));
const Propostas = lazy(() => import("./pages/Propostas"));
const PropostasComerciais = lazy(() => import("./pages/PropostasComerciais"));
const PropostaPublica = lazy(() => import("./pages/PropostaPublica"));
const PropostaInsights = lazy(() => import("./pages/PropostaInsights"));
const Contratos = lazy(() => import("./pages/Contratos"));
const ContratoDetalhes = lazy(() => import("./pages/ContratoDetalhes"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Unsubscribe = lazy(() => import("./pages/Unsubscribe"));

const LoadingFallback = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
  </div>
);

const App = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <Suspense fallback={<LoadingFallback />}>
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
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;
