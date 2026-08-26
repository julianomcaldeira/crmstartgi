import { ReactNode, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  Target,
  CheckSquare,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  X,
  UsersRound,
  Building2,
  GitBranch,
  Upload,
  Radar,
  Brain,
  Mail,
  FileText,
  ScrollText,
  TrendingUp,
  PieChart,
  Rocket,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import logo from "@/assets/logo-evolua-crm.png";
import { NotificationSystem } from "./NotificationSystem";
import { AlertsPanel } from "./AlertsPanel";
import { ThemeToggle } from "./ThemeToggle";
import { useSessionTracker } from "@/hooks/useSessionTracker";
import { useAuth } from "@/contexts/AuthContext";

interface LayoutProps {
  children: ReactNode;
}

interface MenuItem {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  path: string;
}

interface MenuSection {
  title: string;
  items: MenuItem[];
}

const Layout = ({ children }: LayoutProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, userProfile, isAdmin, isPreVendas, signOut } = useAuth();

  useSessionTracker(user?.id ?? null);

  const handleLogout = async () => {
    await signOut();
    toast.success("Logout realizado com sucesso!");
    navigate("/auth");
  };

  const menuSections: MenuSection[] = [
    {
      title: "Visão Geral",
      items: [
        { icon: LayoutDashboard, label: "Dashboard", path: "/" },
      ],
    },
    {
      title: "Comercial",
      items: [
        { icon: Users, label: "Prospects", path: "/prospects" },
        { icon: Target, label: "Oportunidades", path: "/oportunidades" },
        { icon: Rocket, label: "Pré-Vendas", path: "/pre-vendas" },
        { icon: Users, label: "Clientes", path: "/clientes" },
        { icon: Building2, label: "Feiras", path: "/feiras" },
      ],
    },
    {
      title: "Atividades",
      items: [
        { icon: CheckSquare, label: "Tarefas", path: "/tarefas" },
        { icon: TrendingUp, label: "Metas", path: "/metas" },
        ...(isAdmin || isPreVendas ? [{ icon: FileText, label: "Propostas", path: "/propostas" }] : []),
        { icon: ScrollText, label: "Contratos", path: "/contratos" },
      ],
    },
    {
      title: "Inteligência",
      items: [
        { icon: Radar, label: "Radar de Leads", path: "/radar-leads" },
        { icon: Brain, label: "Inteligência de Mercado", path: "/inteligencia-mercado" },
        { icon: PieChart, label: "Relatórios", path: "/relatorios" },
        { icon: UsersRound, label: "Métricas de Equipe", path: "/metricas-equipe" },
      ],
    },
    {
      title: "Sistema",
      items: [
        { icon: Mail, label: "Dashboard E-mails", path: "/emails-dashboard" },
        { icon: GitBranch, label: "Processo de Vendas", path: "/processo-vendas" },
        { icon: Upload, label: "Importação", path: "/importacao" },
        ...(isAdmin ? [{ icon: Settings, label: "Admin", path: "/admin" }] : []),
        { icon: Settings, label: "Configurações", path: "/configuracoes" },
      ],
    },
  ];

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <NotificationSystem />
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full w-64 bg-sidebar z-50 transform transition-transform duration-300 shadow-xl ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        } lg:translate-x-0`}
        role="complementary"
        aria-label="Menu lateral"
      >
        <div className="flex flex-col h-full">
          {/* Logo Section */}
          <div className="relative flex items-center justify-center p-5 border-b border-sidebar-border/50">
            <div className="absolute inset-0 bg-gradient-to-br from-sidebar via-sidebar to-primary/10" />
            
            <div className="relative flex flex-col items-center gap-2">
              <div className="bg-white/95 rounded-xl p-3 shadow-lg">
                <img src={logo} alt="Evolua CRM" className="h-16 w-auto object-contain" />
              </div>
            </div>
            
            <button
              className="lg:hidden text-sidebar-foreground absolute right-4 top-4 hover:text-primary transition-colors"
              onClick={() => setSidebarOpen(false)}
              aria-label="Fechar menu"
            >
              <X size={24} />
            </button>
          </div>

          {/* Menu Items */}
          <ScrollArea className="flex-1 px-3">
            <nav aria-label="Navegação principal" className="py-4 space-y-4">
              {menuSections.map((section) => (
                <div key={section.title}>
                  <p className="px-4 mb-1 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">
                    {section.title}
                  </p>
                  <div className="space-y-0.5">
                    {section.items.map((item) => {
                      const Icon = item.icon;
                      const isActive = location.pathname === item.path;
                      
                      return (
                        <button
                          key={item.path}
                          onClick={() => {
                            navigate(item.path);
                            setSidebarOpen(false);
                          }}
                          aria-current={isActive ? "page" : undefined}
                          className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg transition-all duration-200 ${
                            isActive
                              ? "bg-primary text-white shadow-md shadow-primary/30"
                              : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                          }`}
                        >
                          <Icon size={18} className={isActive ? "text-white" : ""} />
                          <span className="font-medium text-sm">{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </nav>
          </ScrollArea>

          {/* User Info & Logout */}
          <div className="p-3 border-t border-sidebar-border/50 space-y-3">
            <div className="px-3 py-2.5 bg-sidebar-accent/50 rounded-lg border border-sidebar-border/30">
              <p className="text-sm font-medium text-sidebar-foreground">
                {userProfile?.full_name || "Usuário"}
              </p>
              <p className="text-xs text-sidebar-foreground/60 truncate">
                {userProfile?.email}
              </p>
            </div>
            <Button
              variant="outline"
              className="w-full justify-center gap-2 bg-sidebar-accent/50 text-sidebar-foreground hover:bg-destructive hover:text-white border-sidebar-border/30 hover:border-destructive transition-all duration-200"
              onClick={handleLogout}
              aria-label="Sair da conta"
            >
              <LogOut size={16} />
              Sair
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="lg:ml-64 flex flex-col h-screen">
        {/* Top Bar */}
        <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-sm border-b border-border px-4 py-3 flex items-center justify-between shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-foreground lg:hidden"
            aria-label="Abrir menu"
          >
            <Menu size={24} />
          </button>
          <div className="lg:hidden">
            <img src={logo} alt="Evolua CRM" className="h-12 w-auto object-contain" />
          </div>
          
          {/* User Profile */}
          <div className="ml-auto flex items-center gap-3 group">
            <ThemeToggle />
            <AlertsPanel />
            
            <div className="hidden sm:block text-right">
              <p className="text-sm font-medium text-foreground">
                {userProfile?.full_name || "Usuário"}
              </p>
              <p className="text-xs text-muted-foreground">
                {userProfile?.user_roles?.[0]?.role === "admin" ? "Administrador" : 
                 userProfile?.user_roles?.[0]?.role === "gestor" ? "Gestor" :
                 userProfile?.user_roles?.[0]?.role === "pre_vendas" ? "Pré-Vendas" : "Vendedor"}
              </p>
            </div>
            <div className="relative">
              <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary to-primary-light p-0.5 ring-2 ring-primary/20 group-hover:ring-primary/40 transition-all">
                {userProfile?.avatar_url ? (
                  <img
                    src={userProfile.avatar_url}
                    alt={userProfile?.full_name ?? ""}
                    className="h-full w-full rounded-full object-cover"
                  />
                ) : (
                  <div className="h-full w-full rounded-full bg-background flex items-center justify-center">
                    <span className="text-lg font-semibold text-primary">
                      {userProfile?.full_name?.charAt(0).toUpperCase() || "U"}
                    </span>
                  </div>
                )}
              </div>
              <div className="absolute bottom-0 right-0 h-3 w-3 bg-green-500 rounded-full border-2 border-background"></div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="px-4 py-4 md:px-6 md:py-6 flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
};

export default Layout;
