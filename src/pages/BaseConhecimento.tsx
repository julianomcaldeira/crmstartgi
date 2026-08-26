import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Plus, Search, FileText, Video, Link as LinkIcon, Trash2, Edit, History, Download, Star, ChevronLeft, ChevronRight, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { KnowledgeBaseComments } from "@/components/KnowledgeBaseComments";

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
  tags?: string[];
  creator?: { full_name: string };
  updater?: { full_name: string };
  is_favorited?: boolean;
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
  const [selectedType, setSelectedType] = useState<"all" | "article" | "video" | "link">("all");
  const [sortBy, setSortBy] = useState<"updated_at" | "created_at" | "title">("updated_at");
  const [selectedTag, setSelectedTag] = useState<string>("all");
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [allTags, setAllTags] = useState<string[]>([]);
  const itemsPerPage = 20;
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [commentsDialogOpen, setCommentsDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<KnowledgeItem | null>(null);
  const [itemHistory, setItemHistory] = useState<HistoryItem[]>([]);
  const [userRole, setUserRole] = useState<string>("");
  const [importing, setImporting] = useState(false);
  
  const [formData, setFormData] = useState({
    title: "",
    content: "",
    type: "article" as "article" | "video" | "link",
    url: "",
    tags: [] as string[],
  });
  
  const [newTag, setNewTag] = useState("");

  useEffect(() => {
    fetchUserRole();
    fetchKnowledgeItems();
  }, []);

  useEffect(() => {
    filterItems();
  }, [search, selectedType, items, sortBy, selectedTag, showFavoritesOnly]);
  
  useEffect(() => {
    setCurrentPage(1);
  }, [search, selectedType, selectedTag, showFavoritesOnly]);

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
    const { data: { user } } = await supabase.auth.getUser();
    
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

    // Fetch user's favorites
    let favoriteIds: string[] = [];
    if (user) {
      const { data: favorites } = await supabase
        .from("knowledge_base_favorites" as any)
        .select("knowledge_base_id")
        .eq("user_id", user.id);
      
      favoriteIds = (favorites || []).map((f: any) => f.knowledge_base_id);
    }

    // Mark favorited items
    const itemsWithFavorites = (data || []).map((item: any) => ({
      ...item,
      is_favorited: favoriteIds.includes(item.id)
    }));

    setItems(itemsWithFavorites as any);
    
    // Extract all unique tags
    const tags = new Set<string>();
    itemsWithFavorites.forEach((item: any) => {
      if (item.tags && Array.isArray(item.tags)) {
        item.tags.forEach((tag: string) => tags.add(tag));
      }
    });
    setAllTags(Array.from(tags).sort());
  };

  const filterItems = () => {
    let filtered = [...items];

    if (search) {
      filtered = filtered.filter(item =>
        item.title.toLowerCase().includes(search.toLowerCase()) ||
        item.content.toLowerCase().includes(search.toLowerCase())
      );
    }

    if (selectedType !== "all") {
      filtered = filtered.filter(item => item.type === selectedType);
    }
    
    if (selectedTag !== "all") {
      filtered = filtered.filter(item => 
        item.tags && item.tags.includes(selectedTag)
      );
    }
    
    if (showFavoritesOnly) {
      filtered = filtered.filter(item => item.is_favorited);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      if (sortBy === "title") {
        return a.title.localeCompare(b.title);
      } else if (sortBy === "created_at") {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      } else {
        return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      }
    });

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
        title: formData.title,
        content: formData.content,
        type: formData.type,
        url: formData.url,
        tags: formData.tags,
        category: "comercial",
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
      type: "article",
      url: "",
      tags: [],
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
        category: "comercial",
        type: formData.type,
        url: formData.url,
        tags: formData.tags,
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
      type: "article",
      url: "",
      tags: [],
    });
    fetchKnowledgeItems();
  };

  const openEditDialog = (item: KnowledgeItem) => {
    setSelectedItem(item);
    setFormData({
      title: item.title,
      content: item.content,
      type: item.type,
      url: item.url || "",
      tags: item.tags || [],
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
  
  const toggleFavorite = async (itemId: string, isFavorited: boolean) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    if (isFavorited) {
      const { error } = await supabase
        .from("knowledge_base_favorites" as any)
        .delete()
        .eq("user_id", user.id)
        .eq("knowledge_base_id", itemId);

      if (error) {
        toast.error("Erro ao remover favorito");
        return;
      }
      toast.success("Removido dos favoritos");
    } else {
      const { error } = await supabase
        .from("knowledge_base_favorites" as any)
        .insert({
          user_id: user.id,
          knowledge_base_id: itemId,
        });

      if (error) {
        toast.error("Erro ao adicionar favorito");
        return;
      }
      toast.success("Adicionado aos favoritos");
    }

    fetchKnowledgeItems();
  };
  
  const addTag = () => {
    if (newTag.trim() && !formData.tags.includes(newTag.trim())) {
      setFormData({
        ...formData,
        tags: [...formData.tags, newTag.trim()]
      });
      setNewTag("");
    }
  };
  
  const removeTag = (tagToRemove: string) => {
    setFormData({
      ...formData,
      tags: formData.tags.filter(tag => tag !== tagToRemove)
    });
  };

  const handleImportKnowledgeBase = async () => {
    setImporting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Você precisa estar logado");
        return;
      }

      toast.info("Importando base de conhecimento...");

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/import-knowledge-base`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Erro ao importar');
      }

      // Show detailed success message
      if (result.duplicates > 0) {
        toast.success(
          `✅ ${result.inserted} novos artigos importados\n⚠️ ${result.duplicates} duplicados ignorados`,
          { duration: 5000 }
        );
      } else {
        toast.success(result.message);
      }
      
      fetchKnowledgeItems();
    } catch (error) {
      console.error('Error importing:', error);
      toast.error("Erro ao importar base de conhecimento");
    } finally {
      setImporting(false);
    }
  };

  const handleExportKnowledgeBase = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Você precisa estar logado");
        return;
      }

      toast.info("Gerando arquivo Excel...");

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/export-knowledge-base`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao exportar');
      }

      // Download the file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `base-conhecimento-${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success("Base de conhecimento exportada com sucesso!");
    } catch (error) {
      console.error('Error exporting:', error);
      toast.error("Erro ao exportar base de conhecimento");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Base de Conhecimento</h1>
            <p className="text-sm text-muted-foreground">
              Acesse documentos, guias e recursos da equipe
            </p>
          </div>
          <Badge variant="secondary" className="text-base px-3 py-1 bg-primary/10 text-primary border-primary/20">
            {filteredItems.length} {filteredItems.length === 1 ? 'artigo' : 'artigos'}
          </Badge>
        </div>

        <div className="flex gap-2">
          {(userRole === "admin" || userRole === "gestor") && (
            <>
              <Button 
                size="sm" 
                variant="outline" 
                className="gap-2"
                onClick={handleImportKnowledgeBase}
                disabled={importing}
              >
                <BookOpen className="h-4 w-4" />
                {importing ? "Importando..." : "Importar"}
              </Button>
              <Button 
                size="sm" 
                variant="outline" 
                className="gap-2"
                onClick={handleExportKnowledgeBase}
              >
                <Download className="h-4 w-4" />
                Exportar Excel
              </Button>
            </>
          )}
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

                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <Select value={formData.type} onValueChange={(v) => setFormData({ ...formData, type: v as any })}>
                    <SelectTrigger className="h-10 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="article">Artigo</SelectItem>
                      <SelectItem value="video">Vídeo</SelectItem>
                      <SelectItem value="link">Link Externo</SelectItem>
                    </SelectContent>
                  </Select>
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
                
                <div className="space-y-2">
                  <Label>Tags</Label>
                  <div className="flex gap-2">
                    <Input
                      value={newTag}
                      onChange={(e) => setNewTag(e.target.value)}
                      placeholder="Digite uma tag..."
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addTag();
                        }
                      }}
                    />
                    <Button type="button" onClick={addTag} variant="outline">
                      Adicionar
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {formData.tags.map(tag => (
                      <Badge key={tag} variant="secondary" className="gap-1">
                        {tag}
                        <button
                          type="button"
                          onClick={() => removeTag(tag)}
                          className="ml-1 hover:text-destructive"
                        >
                          ×
                        </button>
                      </Badge>
                    ))}
                  </div>
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
      </div>

      {/* Filtros */}
      <div className="space-y-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar na base de conhecimento..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant={showFavoritesOnly ? "default" : "outline"}
              onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
              className="gap-2"
            >
              <Star className="h-4 w-4" />
              Favoritos
            </Button>
            <Button
              size="sm"
              variant={selectedType === "all" ? "default" : "outline"}
              onClick={() => setSelectedType("all")}
              className="gap-2"
            >
              <BookOpen className="h-4 w-4" />
              Todos
            </Button>
            <Button
              size="sm"
              variant={selectedType === "article" ? "default" : "outline"}
              onClick={() => setSelectedType("article")}
              className="gap-2"
            >
              <FileText className="h-4 w-4" />
              Artigos
            </Button>
            <Button
              size="sm"
              variant={selectedType === "video" ? "default" : "outline"}
              onClick={() => setSelectedType("video")}
              className="gap-2"
            >
              <Video className="h-4 w-4" />
              Vídeos
            </Button>
            <Button
              size="sm"
              variant={selectedType === "link" ? "default" : "outline"}
              onClick={() => setSelectedType("link")}
              className="gap-2"
            >
              <LinkIcon className="h-4 w-4" />
              Links
            </Button>
          </div>
          
          <div className="flex items-center gap-2">
            <Label className="text-sm text-muted-foreground">Ordenar por:</Label>
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
              <SelectTrigger className="h-9 w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="updated_at">Última atualização</SelectItem>
                <SelectItem value="created_at">Data de criação</SelectItem>
                <SelectItem value="title">Título (A-Z)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        
        {allTags.length > 0 && (
          <div className="flex flex-wrap gap-2 items-center">
            <Label className="text-sm text-muted-foreground">Tags:</Label>
            <Button
              size="sm"
              variant={selectedTag === "all" ? "default" : "outline"}
              onClick={() => setSelectedTag("all")}
            >
              Todas
            </Button>
            {allTags.map(tag => (
              <Button
                key={tag}
                size="sm"
                variant={selectedTag === tag ? "default" : "outline"}
                onClick={() => setSelectedTag(tag)}
              >
                {tag}
              </Button>
            ))}
          </div>
        )}
      </div>

      {/* Lista de Itens */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredItems.length === 0 ? (
          <div className="col-span-full text-center py-12">
            <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">
              {search
                ? "Nenhum item encontrado"
                : "Nenhum item na base de conhecimento"}
            </p>
          </div>
        ) : (
          filteredItems
            .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
            .map(item => (
            <Card key={item.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 flex-1">
                    {getTypeIcon(item.type)}
                  </div>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => toggleFavorite(item.id, item.is_favorited || false)}
                      title={item.is_favorited ? "Remover dos favoritos" : "Adicionar aos favoritos"}
                    >
                      <Star className={`h-3 w-3 ${item.is_favorited ? 'fill-yellow-400 text-yellow-400' : ''}`} />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setSelectedItem(item);
                        setCommentsDialogOpen(true);
                      }}
                      title="Comentários"
                    >
                      <MessageSquare className="h-3 w-3" />
                    </Button>
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
                {item.tags && item.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {item.tags.map(tag => (
                      <Badge key={tag} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}
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
      
      {/* Paginação */}
      {filteredItems.length > itemsPerPage && (
        <div className="flex justify-center mt-6">
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Anterior
                </Button>
              </PaginationItem>
              
              {Array.from({ length: Math.ceil(filteredItems.length / itemsPerPage) }, (_, i) => i + 1)
                .filter(page => {
                  const totalPages = Math.ceil(filteredItems.length / itemsPerPage);
                  return page === 1 || 
                         page === totalPages || 
                         (page >= currentPage - 1 && page <= currentPage + 1);
                })
                .map((page, index, array) => {
                  if (index > 0 && page - array[index - 1] > 1) {
                    return [
                      <PaginationItem key={`ellipsis-${page}`}>
                        <span className="px-4">...</span>
                      </PaginationItem>,
                      <PaginationItem key={page}>
                        <PaginationLink
                          onClick={() => setCurrentPage(page)}
                          isActive={currentPage === page}
                        >
                          {page}
                        </PaginationLink>
                      </PaginationItem>
                    ];
                  }
                  return (
                    <PaginationItem key={page}>
                      <PaginationLink
                        onClick={() => setCurrentPage(page)}
                        isActive={currentPage === page}
                      >
                        {page}
                      </PaginationLink>
                    </PaginationItem>
                  );
                })}
              
              <PaginationItem>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => 
                    Math.min(Math.ceil(filteredItems.length / itemsPerPage), prev + 1)
                  )}
                  disabled={currentPage === Math.ceil(filteredItems.length / itemsPerPage)}
                >
                  Próxima
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}

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

            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={formData.type} onValueChange={(v) => setFormData({ ...formData, type: v as any })}>
                <SelectTrigger className="h-10 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="article">Artigo</SelectItem>
                  <SelectItem value="video">Vídeo</SelectItem>
                  <SelectItem value="link">Link Externo</SelectItem>
                </SelectContent>
              </Select>
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
            
            <div className="space-y-2">
              <Label>Tags</Label>
              <div className="flex gap-2">
                <Input
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  placeholder="Digite uma tag..."
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addTag();
                    }
                  }}
                />
                <Button type="button" onClick={addTag} variant="outline">
                  Adicionar
                </Button>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {formData.tags.map(tag => (
                  <Badge key={tag} variant="secondary" className="gap-1">
                    {tag}
                    <button
                      type="button"
                      onClick={() => removeTag(tag)}
                      className="ml-1 hover:text-destructive"
                    >
                      ×
                    </button>
                  </Badge>
                ))}
              </div>
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

      {/* Comments Dialog */}
      <Dialog open={commentsDialogOpen} onOpenChange={setCommentsDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Discussões</DialogTitle>
            {selectedItem && (
              <p className="text-sm text-muted-foreground">{selectedItem.title}</p>
            )}
          </DialogHeader>
          {selectedItem && (
            <KnowledgeBaseComments knowledgeBaseId={selectedItem.id} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BaseConhecimento;
