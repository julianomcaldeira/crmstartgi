import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { MessageSquare, Send, Trash2, Edit2, X } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Comment {
  id: string;
  knowledge_base_id: string;
  user_id: string;
  comment: string;
  created_at: string;
  updated_at: string;
  user?: {
    full_name: string;
    email: string;
  };
}

interface KnowledgeBaseCommentsProps {
  knowledgeBaseId: string;
}

export const KnowledgeBaseComments = ({ knowledgeBaseId }: KnowledgeBaseCommentsProps) => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchComments();
    getCurrentUser();

    // Subscribe to realtime changes
    const channel = supabase
      .channel(`comments-${knowledgeBaseId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'knowledge_base_comments',
          filter: `knowledge_base_id=eq.${knowledgeBaseId}`
        },
        () => {
          fetchComments();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [knowledgeBaseId]);

  const getCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) setCurrentUserId(user.id);
  };

  const fetchComments = async () => {
    const { data, error } = await supabase
      .from("knowledge_base_comments")
      .select(`
        *,
        user:profiles(full_name, email)
      `)
      .eq("knowledge_base_id", knowledgeBaseId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error fetching comments:", error);
      return;
    }

    setComments(data as any);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || isSubmitting) return;

    setIsSubmitting(true);

    const { error } = await supabase
      .from("knowledge_base_comments")
      .insert({
        knowledge_base_id: knowledgeBaseId,
        user_id: currentUserId,
        comment: newComment.trim(),
      });

    if (error) {
      toast.error("Erro ao adicionar comentário");
      console.error(error);
    } else {
      setNewComment("");
      toast.success("Comentário adicionado!");
    }

    setIsSubmitting(false);
  };

  const handleEdit = async (commentId: string) => {
    if (!editText.trim() || isSubmitting) return;

    setIsSubmitting(true);

    const { error } = await supabase
      .from("knowledge_base_comments")
      .update({ comment: editText.trim() })
      .eq("id", commentId);

    if (error) {
      toast.error("Erro ao atualizar comentário");
      console.error(error);
    } else {
      setEditingId(null);
      setEditText("");
      toast.success("Comentário atualizado!");
    }

    setIsSubmitting(false);
  };

  const handleDelete = async (commentId: string) => {
    if (!confirm("Tem certeza que deseja excluir este comentário?")) return;

    const { error } = await supabase
      .from("knowledge_base_comments")
      .delete()
      .eq("id", commentId);

    if (error) {
      toast.error("Erro ao excluir comentário");
      console.error(error);
    } else {
      toast.success("Comentário excluído!");
    }
  };

  const startEdit = (comment: Comment) => {
    setEditingId(comment.id);
    setEditText(comment.comment);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditText("");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Discussões ({comments.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Comment form */}
        <form onSubmit={handleSubmit} className="space-y-2">
          <Textarea
            placeholder="Adicione um comentário..."
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            className="min-h-[80px]"
          />
          <div className="flex justify-end">
            <Button type="submit" size="sm" disabled={!newComment.trim() || isSubmitting}>
              <Send className="h-4 w-4 mr-2" />
              Enviar
            </Button>
          </div>
        </form>

        {/* Comments list */}
        <div className="space-y-4 mt-6">
          {comments.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Nenhum comentário ainda. Seja o primeiro a comentar!
            </p>
          ) : (
            comments.map((comment) => (
              <div key={comment.id} className="flex gap-3 p-3 rounded-lg bg-muted/50">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="text-xs">
                    {comment.user?.full_name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">{comment.user?.full_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(comment.created_at), {
                          addSuffix: true,
                          locale: ptBR,
                        })}
                        {comment.updated_at !== comment.created_at && " (editado)"}
                      </p>
                    </div>
                    {currentUserId === comment.user_id && (
                      <div className="flex gap-1">
                        {editingId !== comment.id && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => startEdit(comment)}
                            >
                              <Edit2 className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(comment.id)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  {editingId === comment.id ? (
                    <div className="space-y-2">
                      <Textarea
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        className="min-h-[60px]"
                      />
                      <div className="flex gap-2 justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={cancelEdit}
                        >
                          <X className="h-3 w-3 mr-1" />
                          Cancelar
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleEdit(comment.id)}
                          disabled={!editText.trim() || isSubmitting}
                        >
                          Salvar
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm whitespace-pre-wrap">{comment.comment}</p>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
};
