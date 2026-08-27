import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Paperclip, Upload, Download, Trash2, FileText, Image, File } from "lucide-react";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";

interface TaskAttachmentsProps {
  taskId: string | null;
  onPendingFilesChange?: (files: File[]) => void;
  pendingFiles?: File[];
}

const TaskAttachments = ({ taskId, onPendingFilesChange, pendingFiles = [] }: TaskAttachmentsProps) => {
  const [attachments, setAttachments] = useState<any[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [previewFile, setPreviewFile] = useState<{ url: string; name: string; type: string } | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  useEffect(() => {
    if (taskId) {
      fetchAttachments();
    }
  }, [taskId]);

  const fetchAttachments = async () => {
    if (!taskId) return;

    try {
      const { data, error } = await supabase
        .from("task_attachments")
        .select("*")
        .eq("task_id", taskId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setAttachments(data || []);
    } catch (error) {
      console.error("Error fetching attachments:", error);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;

    const files = Array.from(e.target.files);

    // If no taskId, store files temporarily for later upload
    if (!taskId) {
      if (onPendingFilesChange) {
        onPendingFilesChange([...pendingFiles, ...files]);
      }
      toast.success(`${files.length} arquivo(s) selecionado(s) para upload`);
      return;
    }

    // If taskId exists, upload immediately
    await uploadFiles(files);
  };

  const uploadFiles = async (files: File[]) => {
    setUploadingFiles(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      for (const file of files) {
        const sanitizedName = file.name
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-zA-Z0-9._-]/g, '_')
          .replace(/_{2,}/g, '_');
        const fileName = `${user.id}/${Date.now()}_${sanitizedName}`;

        const { error: uploadError } = await supabase.storage
          .from("task-attachments")
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        const { error: dbError } = await supabase
          .from("task_attachments")
          .insert({
            task_id: taskId as string,
            file_name: file.name,
            file_path: fileName,
            file_size: file.size,
            file_type: file.type,
            uploaded_by: user.id,
          });

        if (dbError) throw dbError;
      }

      toast.success("Arquivos enviados com sucesso!");
      fetchAttachments();
    } catch (error: any) {
      console.error("Error uploading files:", error);
      toast.error(error.message || "Erro ao enviar arquivos");
    } finally {
      setUploadingFiles(false);
    }
  };

  // Function to upload pending files after task is created
  const uploadPendingFiles = async (newTaskId: string) => {
    if (pendingFiles.length === 0) return;

    setUploadingFiles(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      for (const file of pendingFiles) {
        const sanitizedName = file.name
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-zA-Z0-9._-]/g, '_')
          .replace(/_{2,}/g, '_');
        const fileName = `${user.id}/${Date.now()}_${sanitizedName}`;

        const { error: uploadError } = await supabase.storage
          .from("task-attachments")
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        const { error: dbError } = await supabase
          .from("task_attachments")
          .insert({
            task_id: newTaskId,
            file_name: file.name,
            file_path: fileName,
            file_size: file.size,
            file_type: file.type,
            uploaded_by: user.id,
          });

        if (dbError) throw dbError;
      }

      toast.success(`${pendingFiles.length} arquivo(s) anexado(s) à tarefa!`);
    } catch (error: any) {
      console.error("Error uploading pending files:", error);
      toast.error(error.message || "Erro ao enviar arquivos");
    } finally {
      setUploadingFiles(false);
    }
  };

  const handlePreview = async (attachment: any) => {
    try {
      const { data, error } = await supabase.storage
        .from("task-attachments")
        .download(attachment.file_path);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      setPreviewFile({ url, name: attachment.file_name, type: attachment.file_type });
    } catch (error: any) {
      console.error("Error previewing file:", error);
      toast.error("Erro ao visualizar arquivo");
    }
  };

  const handleDownload = async (attachment: any) => {
    try {
      const { data, error } = await supabase.storage
        .from("task-attachments")
        .download(attachment.file_path);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = attachment.file_name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error: any) {
      console.error("Error downloading file:", error);
      toast.error("Erro ao baixar arquivo");
    }
  };

  const handleDeleteAttachment = async (attachment: any) => {
    try {
      const { error: storageError } = await supabase.storage
        .from("task-attachments")
        .remove([attachment.file_path]);

      if (storageError) throw storageError;

      const { error: dbError } = await supabase
        .from("task_attachments")
        .delete()
        .eq("id", attachment.id);

      if (dbError) throw dbError;

      toast.success("Arquivo removido!");
      fetchAttachments();
    } catch (error: any) {
      console.error("Error deleting attachment:", error);
      toast.error("Erro ao remover arquivo");
    }
  };

  const removePendingFile = (index: number) => {
    if (onPendingFilesChange) {
      const newFiles = [...pendingFiles];
      newFiles.splice(index, 1);
      onPendingFilesChange(newFiles);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const getFileIcon = (fileType: string) => {
    if (fileType?.startsWith('image/')) return <Image className="h-4 w-4" />;
    if (fileType === 'application/pdf') return <FileText className="h-4 w-4" />;
    return <File className="h-4 w-4" />;
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files);
      
      if (!taskId) {
        if (onPendingFilesChange) {
          onPendingFilesChange([...pendingFiles, ...files]);
        }
        toast.success(`${files.length} arquivo(s) selecionado(s) para upload`);
        return;
      }
      
      uploadFiles(files);
    }
  }, [taskId, pendingFiles, onPendingFilesChange, uploadFiles]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Paperclip className="h-4 w-4" />
          Anexos {taskId && `(${attachments.length})`}
        </div>
        <label htmlFor="task-file-upload" className="cursor-pointer">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={uploadingFiles}
            asChild
          >
            <span>
              <Upload className="h-4 w-4 mr-2" />
              {uploadingFiles ? "Enviando..." : "Adicionar"}
            </span>
          </Button>
          <input
            id="task-file-upload"
            type="file"
            multiple
            onChange={handleFileSelect}
            className="hidden"
          />
        </label>
      </div>

      {/* Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-lg p-4 transition-all text-center ${
          isDragOver 
            ? 'border-primary bg-primary/10 scale-[1.02]' 
            : 'border-muted-foreground/25 hover:border-primary/50'
        }`}
      >
        <Upload className={`h-8 w-8 mx-auto mb-2 transition-colors ${isDragOver ? 'text-primary' : 'text-muted-foreground'}`} />
        <p className="text-sm text-muted-foreground">
          {isDragOver ? (
            <span className="text-primary font-medium">Solte os arquivos aqui</span>
          ) : (
            <>
              Arraste arquivos aqui ou use o botão acima
            </>
          )}
        </p>
        {uploadingFiles && (
          <p className="text-xs text-primary mt-2 animate-pulse">Enviando arquivos...</p>
        )}
      </div>

      {/* Pending files (for new tasks) */}
      {pendingFiles.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Arquivos pendentes (serão enviados ao salvar):</p>
          {pendingFiles.map((file, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-2 rounded-lg border bg-warning/10 border-warning/20"
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {getFileIcon(file.type)}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(file.size)}
                  </p>
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removePendingFile(index)}
                className="h-8 w-8 p-0 text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Existing attachments */}
      {attachments.length > 0 && (
        <div className="space-y-2">
          {attachments.map((attachment) => {
            const isImage = attachment.file_type?.startsWith('image/');
            const isPDF = attachment.file_type === 'application/pdf';
            const canPreview = isImage || isPDF;

            return (
              <div
                key={attachment.id}
                className="flex items-center justify-between p-2 rounded-lg border bg-muted/50 hover:bg-muted transition-colors"
              >
                <div
                  className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer"
                  onClick={() => canPreview && handlePreview(attachment)}
                >
                  {getFileIcon(attachment.file_type)}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate hover:underline">{attachment.file_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatFileSize(attachment.file_size)} • {format(parseISO(attachment.created_at), "dd/MM/yyyy HH:mm")}
                      {canPreview && " • Clique para visualizar"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDownload(attachment)}
                    className="h-8 w-8 p-0"
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteAttachment(attachment)}
                    className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {taskId && attachments.length === 0 && pendingFiles.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-3">
          Nenhum arquivo anexado
        </p>
      )}

      {/* Preview modal */}
      {previewFile && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
          onClick={() => {
            URL.revokeObjectURL(previewFile.url);
            setPreviewFile(null);
          }}
        >
          <div className="max-w-4xl max-h-[90vh] p-4 bg-background rounded-lg shadow-lg overflow-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">{previewFile.name}</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  URL.revokeObjectURL(previewFile.url);
                  setPreviewFile(null);
                }}
              >
                Fechar
              </Button>
            </div>
            {previewFile.type?.startsWith('image/') ? (
              <img
                src={previewFile.url}
                alt={previewFile.name}
                className="max-w-full max-h-[70vh] object-contain"
              />
            ) : (
              <iframe
                src={previewFile.url}
                title={previewFile.name}
                className="w-full h-[70vh]"
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// Export the upload function for use in task creation
export const uploadTaskAttachments = async (taskId: string, files: File[]) => {
  if (files.length === 0) return;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Usuário não autenticado");

  for (const file of files) {
    const sanitizedName = file.name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .replace(/_{2,}/g, '_');
    const fileName = `${user.id}/${Date.now()}_${sanitizedName}`;

    const { error: uploadError } = await supabase.storage
      .from("task-attachments")
      .upload(fileName, file);

    if (uploadError) throw uploadError;

    const { error: dbError } = await supabase
      .from("task_attachments")
      .insert({
        task_id: taskId,
        file_name: file.name,
        file_path: fileName,
        file_size: file.size,
        file_type: file.type,
        uploaded_by: user.id,
      });

    if (dbError) throw dbError;
  }
};

export default TaskAttachments;
