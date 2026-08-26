import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User, Session } from "@supabase/supabase-js";

interface UserProfile {
  id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  user_roles: { role: string }[];
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  userProfile: UserProfile | null;
  loading: boolean;
  role: string | null;
  isAdmin: boolean;
  isGestor: boolean;
  isPreVendas: boolean;
  isPrivileged: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUserProfile = async (userId: string) => {
    const { data } = await supabase
      .from("profiles")
      .select("*, user_roles(role)")
      .eq("id", userId)
      .single();

    setUserProfile(data);
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);

        if (!session) {
          navigate("/auth");
          setUserProfile(null);
          setLoading(false);
        } else {
          fetchUserProfile(session.user.id).finally(() => setLoading(false));
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (!session) {
        navigate("/auth");
        setLoading(false);
      } else {
        fetchUserProfile(session.user.id).finally(() => setLoading(false));
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const role = userProfile?.user_roles?.[0]?.role ?? null;
  const isAdmin = role === "admin";
  const isGestor = role === "gestor";
  const isPreVendas = role === "pre_vendas";
  const isPrivileged = isAdmin || isGestor;

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        userProfile,
        loading,
        role,
        isAdmin,
        isGestor,
        isPreVendas,
        isPrivileged,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
