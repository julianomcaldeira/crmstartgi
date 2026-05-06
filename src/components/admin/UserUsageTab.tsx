import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Clock, Users, Activity } from "lucide-react";
import { format, subDays, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { fetchAllPaged } from "@/lib/fetchAllPaged";

type Range = "7" | "30" | "90" | "all";

interface SessionRow {
  user_id: string;
  started_at: string;
  last_seen_at: string;
  duration_seconds: number;
}

interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
}

const formatDuration = (seconds: number) => {
  if (!seconds || seconds < 0) return "0min";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h === 0) return `${m}min`;
  return `${h}h ${m}min`;
};

export const UserUsageTab = () => {
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<Range>("30");
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);

  const fetchData = async () => {
    setLoading(true);
    const since = range !== "all"
      ? startOfDay(subDays(new Date(), parseInt(range))).toISOString()
      : null;

    const data = await fetchAllPaged<SessionRow>(async (from, to) => {
      let q = supabase
        .from("user_sessions")
        .select("user_id, started_at, last_seen_at, duration_seconds")
        .order("started_at", { ascending: false })
        .order("user_id", { ascending: true })
        .range(from, to);
      if (since) q = q.gte("started_at", since);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    });
    setSessions(data || []);

    const { data: profs } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .or("is_deleted.is.null,is_deleted.eq.false");
    setProfiles(profs || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range]);

  const aggregated = useMemo(() => {
    const map = new Map<string, { totalSec: number; sessions: number; lastSeen: string }>();
    for (const s of sessions) {
      const cur = map.get(s.user_id) || { totalSec: 0, sessions: 0, lastSeen: s.last_seen_at };
      cur.totalSec += s.duration_seconds || 0;
      cur.sessions += 1;
      if (new Date(s.last_seen_at) > new Date(cur.lastSeen)) cur.lastSeen = s.last_seen_at;
      map.set(s.user_id, cur);
    }
    const profMap = new Map(profiles.map((p) => [p.id, p]));
    const rows = Array.from(map.entries()).map(([userId, v]) => ({
      userId,
      name: profMap.get(userId)?.full_name || "Usuário desconhecido",
      email: profMap.get(userId)?.email || "",
      totalSec: v.totalSec,
      sessions: v.sessions,
      avgSec: v.sessions ? Math.round(v.totalSec / v.sessions) : 0,
      lastSeen: v.lastSeen,
    }));
    rows.sort((a, b) => b.totalSec - a.totalSec);
    return rows;
  }, [sessions, profiles]);

  const totals = useMemo(() => {
    const totalSec = aggregated.reduce((acc, r) => acc + r.totalSec, 0);
    const totalSessions = aggregated.reduce((acc, r) => acc + r.sessions, 0);
    return {
      totalSec,
      totalSessions,
      activeUsers: aggregated.filter((r) => r.totalSec > 0).length,
    };
  }, [aggregated]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h3 className="text-lg font-semibold">Tempo de uso da plataforma por vendedor</h3>
          <p className="text-sm text-muted-foreground">
            Sessões são registradas a cada minuto enquanto o usuário interage com o sistema.
          </p>
        </div>
        <Select value={range} onValueChange={(v) => setRange(v as Range)}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Últimos 7 dias</SelectItem>
            <SelectItem value="30">Últimos 30 dias</SelectItem>
            <SelectItem value="90">Últimos 90 dias</SelectItem>
            <SelectItem value="all">Todo o período</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium">Tempo total</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatDuration(totals.totalSec)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium">Usuários ativos</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totals.activeUsers}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium">Sessões</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totals.totalSessions}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center p-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : aggregated.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              Nenhuma sessão registrada no período.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vendedor</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead className="text-right">Tempo total</TableHead>
                  <TableHead className="text-right">Sessões</TableHead>
                  <TableHead className="text-right">Média/sessão</TableHead>
                  <TableHead>Último acesso</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {aggregated.map((row) => (
                  <TableRow key={row.userId}>
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{row.email}</TableCell>
                    <TableCell className="text-right font-semibold">{formatDuration(row.totalSec)}</TableCell>
                    <TableCell className="text-right">{row.sessions}</TableCell>
                    <TableCell className="text-right">{formatDuration(row.avgSec)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(row.lastSeen), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
