import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Plus, Search, FileText, Video, Link as LinkIcon, Trash2, Edit, History } from "lucide-react";
import { toast } from "sonner";

interface KnowledgeItem {
  id: string;
  title: string;
  content: string;
  category: string;
  type: "article" | "video" | "link";
  url?: string;
  created_at: string;
  created_by: string;
  updated_at: string;
  updated_by?: string;
  creator?: { full_name: string };
  updater?: { full_name: string };
}

interface HistoryItem {
  id: string;
  change_type: string;
  changed_at: string;
  changed_by: string;
  changer?: { full_name: string };
  old_data?: any;
  new_data?: any;
}

const BaseConhecimento = () => {
  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [filteredItems, setFilteredItems] = useState<KnowledgeItem[]>([]);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<KnowledgeItem | null>(null);
  const [itemHistory, setItemHistory] = useState<HistoryItem[]>([]);
  const [userRole, setUserRole] = useState<string>("");
  
  const [formData, setFormData] = useState({
    title: "",
    content: "",
    category: "",
    type: "article" as "article" | "video" | "link",
    url: "",
  });

  const categories = ["Produtos", "Processos", "Vendas", "Técnico", "Suporte", "Onboarding"];

  useEffect(() => {
    fetchUserRole();
    fetchKnowledgeItems();
  }, []);

  useEffect(() => {
    filterItems();
  }, [search, selectedCategory, items]);

  const fetchUserRole = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    setUserRole(roleData?.role || "vendedor");
  };

  const fetchKnowledgeItems = async () => {
    const { data, error } = await supabase
      .from("knowledge_base")
      .select(`
        *,
        creator:profiles!knowledge_base_created_by_fkey(full_name),
        updater:profiles!knowledge_base_updated_by_fkey(full_name)
      `)
      .order("updated_at", { ascending: false });

    if (error) {
      console.error("Error fetching knowledge items:", error);
      return;
    }

    setItems((data || []) as any);
  };

  const filterItems = () => {
    let filtered = [...items];

    if (search) {
      filtered = filtered.filter(item =>
        item.title.toLowerCase().includes(search.toLowerCase()) ||
        item.content.toLowerCase().includes(search.toLowerCase())
      );
    }

    if (selectedCategory) {
      filtered = filtered.filter(item => item.category === selectedCategory);
    }

    setFilteredItems(filtered);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Você precisa estar logado");
      return;
    }

    const { error } = await supabase
      .from("knowledge_base")
      .insert({
        ...formData,
        created_by: user.id,
      });

    if (error) {
      toast.error("Erro ao criar item");
      console.error(error);
      return;
    }

    toast.success("Item criado com sucesso!");
    setDialogOpen(false);
    setFormData({
      title: "",
      content: "",
      category: "",
      type: "article",
      url: "",
    });
    fetchKnowledgeItems();
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedItem) return;

    const { error } = await supabase
      .from("knowledge_base")
      .update({
        title: formData.title,
        content: formData.content,
        category: formData.category,
        type: formData.type,
        url: formData.url,
      })
      .eq("id", selectedItem.id);

    if (error) {
      toast.error("Erro ao atualizar item");
      console.error(error);
      return;
    }

    toast.success("Item atualizado com sucesso!");
    setEditDialogOpen(false);
    setSelectedItem(null);
    setFormData({
      title: "",
      content: "",
      category: "",
      type: "article",
      url: "",
    });
    fetchKnowledgeItems();
  };

  const openEditDialog = (item: KnowledgeItem) => {
    setSelectedItem(item);
    setFormData({
      title: item.title,
      content: item.content,
      category: item.category,
      type: item.type,
      url: item.url || "",
    });
    setEditDialogOpen(true);
  };

  const fetchItemHistory = async (itemId: string) => {
    const { data, error } = await supabase
      .from("knowledge_base_history")
      .select("*")
      .eq("knowledge_base_id", itemId)
      .order("changed_at", { ascending: false });

    if (error) {
      console.error("Error fetching history:", error);
      return;
    }

    // Fetch changer profiles separately
    const historyWithProfiles = await Promise.all(
      (data || []).map(async (item) => {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", item.changed_by)
          .single();
        
        return {
          ...item,
          changer: profile
        };
      })
    );

    setItemHistory(historyWithProfiles as any);
  };

  const openHistoryDialog = async (item: KnowledgeItem) => {
    setSelectedItem(item);
    await fetchItemHistory(item.id);
    setHistoryDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este item?")) return;

    const { error } = await supabase
      .from("knowledge_base")
      .delete()
      .eq("id", id);

    if (error) {
      toast.error("Erro ao excluir item");
      return;
    }

    toast.success("Item excluído com sucesso!");
    fetchKnowledgeItems();
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "article":
        return <FileText className="h-4 w-4" />;
      case "video":
        return <Video className="h-4 w-4" />;
      case "link":
        return <LinkIcon className="h-4 w-4" />;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "article":
        return "Artigo";
      case "video":
        return "Vídeo";
      case "link":
        return "Link";
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Base de Conhecimento</h1>
          <p className="text-sm text-muted-foreground">
            Acesse documentos, guias e recursos da equipe
          </p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2">
              <Plus className="h-4 w-4" />
              Novo Item
            </Button>
          </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Adicionar à Base de Conhecimento</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Título</Label>
                  <Input
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Categoria</Label>
                    <select
                      className="w-full border rounded-md p-2 text-sm"
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      required
                    >
                      <option value="">Selecione...</option>
                      {categories.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label>Tipo</Label>
                    <select
                      className="w-full border rounded-md p-2 text-sm"
                      value={formData.type}
                      onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                      required
                    >
                      <option value="article">Artigo</option>
                      <option value="video">Vídeo</option>
                      <option value="link">Link Externo</option>
                    </select>
                  </div>
                </div>

                {(formData.type === "video" || formData.type === "link") && (
                  <div className="space-y-2">
                    <Label>URL</Label>
                    <Input
                      type="url"
                      value={formData.url}
                      onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                      placeholder="https://..."
                      required
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Conteúdo</Label>
                  <Textarea
                    value={formData.content}
                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                    rows={6}
                    required
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit">Criar Item</Button>
                </div>
              </form>
            </DialogContent>
        </Dialog>
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar na base de conhecimento..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Categorias */}
      <div className="flex gap-2 flex-wrap">
        <Badge
          variant={!selectedCategory ? "default" : "outline"}
          className="cursor-pointer"
          onClick={() => setSelectedCategory(null)}
        >
          Todas
        </Badge>
        {categories.map(cat => (
          <Badge
            key={cat}
            variant={selectedCategory === cat ? "default" : "outline"}
            className="cursor-pointer"
            onClick={() => setSelectedCategory(cat)}
          >
            {cat}
          </Badge>
        ))}
      </div>

      {/* Lista de Itens */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredItems.length === 0 ? (
          <div className="col-span-full text-center py-12">
            <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">
              {search || selectedCategory
                ? "Nenhum item encontrado"
                : "Nenhum item na base de conhecimento"}
            </p>
          </div>
        ) : (
          filteredItems.map(item => (
            <Card key={item.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 flex-1">
                    {getTypeIcon(item.type)}
                    <Badge variant="secondary" className="text-xs">
                      {item.category}
                    </Badge>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => openEditDialog(item)}
                      title="Editar"
                    >
                      <Edit className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => openHistoryDialog(item)}
                      title="Ver histórico"
                    >
                      <History className="h-3 w-3" />
                    </Button>
                    {(userRole === "admin" || userRole === "gestor") && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(item.id)}
                        title="Excluir"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
                <CardTitle className="text-base">{item.title}</CardTitle>
                <CardDescription className="text-xs">
                  {getTypeLabel(item.type)}
                  {item.updater && item.updater.full_name && (
                    <span className="ml-2">• Editado por {item.updater.full_name}</span>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground line-clamp-3">
                  {item.content}
                </p>
                {item.url && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full"
                    onClick={() => window.open(item.url, "_blank")}
                  >
                    {item.type === "video" ? "Assistir Vídeo" : "Abrir Link"}
                  </Button>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Item</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4">
            <div className="space-y-2">
              <Label>Título</Label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Categoria</Label>
                <select
                  className="w-full border rounded-md p-2 text-sm"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  required
                >
                  <option value="">Selecione...</option>
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label>Tipo</Label>
                <select
                  className="w-full border rounded-md p-2 text-sm"
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                  required
                >
                  <option value="article">Artigo</option>
                  <option value="video">Vídeo</option>
                  <option value="link">Link Externo</option>
                </select>
              </div>
            </div>

            {(formData.type === "video" || formData.type === "link") && (
              <div className="space-y-2">
                <Label>URL</Label>
                <Input
                  type="url"
                  value={formData.url}
                  onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                  placeholder="https://..."
                  required
                />
              </div>
            )}

            <div className="space-y-2">
              <Label>Conteúdo</Label>
              <Textarea
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                rows={6}
                required
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setEditDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit">Salvar Alterações</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* History Dialog */}
      <Dialog open={historyDialogOpen} onOpenChange={setHistoryDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Histórico de Mudanças</DialogTitle>
            {selectedItem && (
              <p className="text-sm text-muted-foreground">{selectedItem.title}</p>
            )}
          </DialogHeader>
          <div className="space-y-4">
            {itemHistory.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Nenhum histórico encontrado
              </p>
            ) : (
              itemHistory.map((historyItem) => (
                <Card key={historyItem.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <Badge variant={historyItem.change_type === "created" ? "default" : "secondary"}>
                        {historyItem.change_type === "created" ? "Criado" : "Atualizado"}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(historyItem.changed_at).toLocaleString("pt-BR")}
                      </span>
                    </div>
                    <p className="text-sm">
                      Por: <span className="font-medium">{historyItem.changer?.full_name || "Usuário desconhecido"}</span>
                    </p>
                  </CardHeader>
                  {historyItem.old_data && (
                    <CardContent className="pt-0">
                      <div className="text-xs space-y-2">
                        <p className="font-medium">Alterações:</p>
                        <div className="bg-muted p-2 rounded">
                          <pre className="whitespace-pre-wrap text-xs">
                            {JSON.stringify(historyItem.new_data, null, 2)}
                          </pre>
                        </div>
                      </div>
                    </CardContent>
                  )}
                </Card>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BaseConhecimento;
