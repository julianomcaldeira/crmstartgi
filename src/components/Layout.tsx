import { ReactNode, useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User, Session } from "@supabase/supabase-js";
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
  BookOpen,
  GitBranch,
  Upload,
  Radar,
  Brain,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import logo from "@/assets/logo-evolua-crm.png";
import { NotificationSystem } from "./NotificationSystem";
import { AlertsPanel } from "./AlertsPanel";

interface LayoutProps {
  children: ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (!session) {
          navigate("/auth");
        } else {
          setTimeout(() => {
            fetchUserProfile(session.user.id);
          }, 0);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (!session) {
        navigate("/auth");
      } else {
        fetchUserProfile(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const fetchUserProfile = async (userId: string) => {
    const { data } = await supabase
      .from("profiles")
      .select("*, user_roles(role)")
      .eq("id", userId)
      .single();
    
    setUserProfile(data);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Logout realizado com sucesso!");
    navigate("/auth");
  };

  const isAdmin = userProfile?.user_roles?.[0]?.role === 'admin';
  const isGestor = userProfile?.user_roles?.[0]?.role === 'gestor';

  const menuItems = [
    { icon: LayoutDashboard, label: "Dashboard", path: "/" },
    { icon: Users, label: "Prospects", path: "/prospects" },
    { icon: Target, label: "Oportunidades", path: "/oportunidades" },
    { icon: Users, label: "Clientes", path: "/clientes" },
    { icon: CheckSquare, label: "Tarefas", path: "/tarefas" },
    { icon: BarChart3, label: "Metas", path: "/metas" },
    { icon: BarChart3, label: "Relatórios", path: "/relatorios" },
    { icon: Building2, label: "Feiras", path: "/feiras" },
    { icon: Radar, label: "Radar de Leads", path: "/radar-leads" },
    { icon: Brain, label: "Inteligência de Mercado", path: "/inteligencia-mercado" },
    { icon: Upload, label: "Importação", path: "/importacao" },
    { icon: BookOpen, label: "Conhecimento", path: "/base-conhecimento" },
    { icon: GitBranch, label: "Processo de Vendas", path: "/processo-vendas" },
    { icon: UsersRound, label: "Métricas de Equipe", path: "/metricas-equipe" },
    ...(isAdmin ? [{ icon: Settings, label: "Admin", path: "/admin" }] : []),
    { icon: Settings, label: "Configurações", path: "/configuracoes" },
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
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full w-64 bg-sidebar z-50 transform transition-transform duration-300 shadow-xl ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        } lg:translate-x-0`}
      >
        <div className="flex flex-col h-full">
          {/* Logo Section - Clean dark design with gradient accent */}
          <div className="relative flex items-center justify-center p-5 border-b border-sidebar-border/50">
            {/* Subtle gradient background */}
            <div className="absolute inset-0 bg-gradient-to-br from-sidebar via-sidebar to-primary/10" />
            
            <div className="relative flex flex-col items-center gap-2">
              {/* Logo with rounded container */}
              <div className="bg-white/95 rounded-xl p-3 shadow-lg">
                <img src={logo} alt="Evolua CRM" className="h-16 w-auto object-contain" />
              </div>
            </div>
            
            <button
              className="lg:hidden text-sidebar-foreground absolute right-4 top-4 hover:text-primary transition-colors"
              onClick={() => setSidebarOpen(false)}
            >
              <X size={24} />
            </button>
          </div>

          {/* Menu Items */}
          <ScrollArea className="flex-1 px-3">
            <nav className="py-4 space-y-1">
              {menuItems.map((item, index) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                
                return (
                  <button
                    key={item.path}
                    onClick={() => {
                      navigate(item.path);
                      setSidebarOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all duration-200 animate-fade-in opacity-0 ${
                      isActive
                        ? "bg-primary text-white shadow-md shadow-primary/30"
                        : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                    }`}
                    style={{
                      animationDelay: `${index * 50}ms`,
                      animationFillMode: 'forwards'
                    }}
                  >
                    <Icon size={18} className={`${isActive ? "text-white" : ""} transition-transform duration-200 group-hover:scale-110`} />
                    <span className="font-medium text-sm">{item.label}</span>
                  </button>
                );
              })}
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
          >
            <Menu size={24} />
          </button>
          <div className="lg:hidden">
            <img src={logo} alt="Evolua CRM" className="h-12 w-auto object-contain" />
          </div>
          
          {/* User Profile */}
          <div className="ml-auto flex items-center gap-3 group">
            <AlertsPanel />
            
            <div className="hidden sm:block text-right">
              <p className="text-sm font-medium text-foreground">
                {userProfile?.full_name || "Usuário"}
              </p>
              <p className="text-xs text-muted-foreground">
                {userProfile?.user_roles?.[0]?.role === "admin" ? "Administrador" : 
                 userProfile?.user_roles?.[0]?.role === "gestor" ? "Gestor" : "Vendedor"}
              </p>
            </div>
            <div className="relative">
              <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary to-primary-light p-0.5 ring-2 ring-primary/20 group-hover:ring-primary/40 transition-all">
                {userProfile?.avatar_url ? (
                  <img
                    src={userProfile.avatar_url}
                    alt={userProfile?.full_name}
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