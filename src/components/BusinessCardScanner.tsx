import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Camera, Upload, Loader2, CreditCard } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ContactData {
  name: string | null;
  role: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  company: string | null;
}

interface BusinessCardScannerProps {
  onContactExtracted: (contact: ContactData) => void;
  disabled?: boolean;
}

export const BusinessCardScanner = ({ onContactExtracted, disabled }: BusinessCardScannerProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);

  const processImage = async (imageBase64: string) => {
    setIsProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke("ocr-business-card", {
        body: { image: imageBase64 },
      });

      if (error) throw error;

      if (data?.contact) {
        onContactExtracted(data.contact);
        toast.success("Cartão de visita processado com sucesso!");
        setIsOpen(false);
        setPreviewImage(null);
      } else {
        toast.error("Não foi possível extrair informações do cartão");
      }
    } catch (err) {
      console.error("OCR error:", err);
      toast.error("Erro ao processar cartão de visita");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      setPreviewImage(base64);
    };
    reader.readAsDataURL(file);
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: "environment" } 
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setIsCameraActive(true);
    } catch (err) {
      console.error("Error accessing camera:", err);
      toast.error("Erro ao acessar câmera. Verifique as permissões.");
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(video, 0, 0);
        const imageData = canvas.toDataURL("image/jpeg");
        setPreviewImage(imageData);
        stopCamera();
      }
    }
  };

  const handleClose = () => {
    stopCamera();
    setPreviewImage(null);
    setIsOpen(false);
  };

  const handleProcess = () => {
    if (previewImage) {
      processImage(previewImage);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) handleClose();
      else setIsOpen(true);
    }}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          className="gap-2"
        >
          <CreditCard className="h-4 w-4" />
          Escanear Cartão
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Escanear Cartão de Visita</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {!previewImage && !isCameraActive && (
            <div className="flex gap-2">
              <Button 
                onClick={startCamera} 
                variant="outline" 
                className="flex-1 gap-2"
              >
                <Camera className="h-4 w-4" />
                Usar Câmera
              </Button>
              <Button
                onClick={() => fileInputRef.current?.click()}
                variant="outline"
                className="flex-1 gap-2"
              >
                <Upload className="h-4 w-4" />
                Upload
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>
          )}

          {isCameraActive && (
            <div className="space-y-4">
              <video
                ref={videoRef}
                className="w-full rounded-lg border"
                autoPlay
                playsInline
              />
              <div className="flex gap-2">
                <Button onClick={capturePhoto} className="flex-1">
                  Capturar Foto
                </Button>
                <Button onClick={stopCamera} variant="outline">
                  Cancelar
                </Button>
              </div>
            </div>
          )}

          {previewImage && (
            <div className="space-y-4">
              <img
                src={previewImage}
                alt="Preview do cartão"
                className="w-full rounded-lg border"
              />
              <div className="flex gap-2">
                <Button
                  onClick={handleProcess}
                  disabled={isProcessing}
                  className="flex-1"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Processando...
                    </>
                  ) : (
                    "Extrair Dados"
                  )}
                </Button>
                <Button
                  onClick={() => setPreviewImage(null)}
                  variant="outline"
                  disabled={isProcessing}
                >
                  Nova Foto
                </Button>
              </div>
            </div>
          )}

          <canvas ref={canvasRef} className="hidden" />
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default BusinessCardScanner;
