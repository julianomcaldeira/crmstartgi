import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { Loader2, Upload, User, Mail, Link as LinkIcon, Unlink } from "lucide-react";

const Configuracoes = () => {
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [zohoConnected, setZohoConnected] = useState(false);
  const [zohoEmail, setZohoEmail] = useState("");
  const [connectingZoho, setConnectingZoho] = useState(false);

  useEffect(() => {
    fetchProfile();
    checkZohoConnection();
    
    // Check for OAuth success callback
    const params = new URLSearchParams(window.location.search);
    if (params.get('zoho') === 'success') {
      toast.success('Conta Zoho Mail conectada com sucesso!');
      checkZohoConnection();
      window.history.replaceState({}, '', '/configuracoes');
    }
  }, []);

  const fetchProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (error) throw error;
      
      setProfile(data);
      setFullName(data.full_name || "");
      setEmail(data.email || "");
      setPhone(data.phone || "");
    } catch (error) {
      console.error("Error fetching profile:", error);
      toast.error("Erro ao carregar perfil");
    }
  };

  const handleUpdateProfile = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: fullName,
          phone: phone,
        })
        .eq("id", user.id);

      if (error) throw error;
      
      toast.success("Perfil atualizado com sucesso!");
      fetchProfile();
    } catch (error) {
      console.error("Error updating profile:", error);
      toast.error("Erro ao atualizar perfil");
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      toast.error("As senhas não coincidem");
      return;
    }

    if (newPassword.length < 6) {
      toast.error("A senha deve ter pelo menos 6 caracteres");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;
      
      toast.success("Senha alterada com sucesso!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      console.error("Error changing password:", error);
      toast.error("Erro ao alterar senha");
    } finally {
      setLoading(false);
    }
  };

  const checkZohoConnection = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('zoho_oauth_tokens')
        .select('zoho_account_email')
        .eq('user_id', user.id)
        .maybeSingle();

      if (data) {
        setZohoConnected(true);
        setZohoEmail(data.zoho_account_email);
      }
    } catch (error) {
      console.error('Error checking Zoho connection:', error);
    }
  };

  const handleConnectZoho = async () => {
    setConnectingZoho(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const ZOHO_CLIENT_ID = '1000.FISW345E8E6C6TZDS2I2QM2R7B2HEY';
      const REDIRECT_URI = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/zoho-auth-callback`;
      const SCOPE = 'ZohoMail.messages.READ,ZohoMail.accounts.READ';

      const authUrl = `https://accounts.zoho.com/oauth/v2/auth?` +
        `scope=${encodeURIComponent(SCOPE)}` +
        `&client_id=${ZOHO_CLIENT_ID}` +
        `&response_type=code` +
        `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
        `&state=${user.id}` +
        `&access_type=offline` +
        `&prompt=consent`;

      window.location.href = authUrl;
    } catch (error: any) {
      console.error('Error connecting Zoho:', error);
      toast.error('Erro ao conectar com Zoho Mail');
      setConnectingZoho(false);
    }
  };

  const handleDisconnectZoho = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('zoho_oauth_tokens')
        .delete()
        .eq('user_id', user.id);

      if (error) throw error;

      setZohoConnected(false);
      setZohoEmail('');
      toast.success('Conta Zoho Mail desconectada');
    } catch (error) {
      console.error('Error disconnecting Zoho:', error);
      toast.error('Erro ao desconectar Zoho Mail');
    }
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error("A imagem deve ter no máximo 10MB");
      return;
    }

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast.error("Por favor, selecione uma imagem");
      return;
    }

    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const fileExt = file.name.split(".").pop();
      const fileName = `${user.id}/avatar.${fileExt}`;

      // Upload the file
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from("avatars")
        .getPublicUrl(fileName);

      // Update profile with new avatar URL
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: publicUrl })
        .eq("id", user.id);

      if (updateError) throw updateError;

      toast.success("Foto de perfil atualizada!");
      fetchProfile();
    } catch (error) {
      console.error("Error uploading avatar:", error);
      toast.error("Erro ao fazer upload da foto");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2">Configurações</h1>
        <p className="text-muted-foreground">
          Gerencie suas informações pessoais e preferências
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Foto de Perfil</CardTitle>
            <CardDescription>
              Atualize sua foto de perfil
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col items-center gap-4">
              <Avatar className="h-32 w-32">
                <AvatarImage src={profile?.avatar_url} />
                <AvatarFallback className="text-2xl">
                  <User size={48} />
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col items-center gap-2">
                <Input
                  id="avatar-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarUpload}
                  className="hidden"
                />
                <Button
                  variant="outline"
                  onClick={() => document.getElementById("avatar-upload")?.click()}
                  disabled={uploading}
                >
                  {uploading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" />
                      Escolher Foto
                    </>
                  )}
                </Button>
                <p className="text-xs text-muted-foreground">
                  PNG, JPG até 10MB
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Informações Pessoais</CardTitle>
            <CardDescription>
              Atualize suas informações básicas
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Nome Completo</Label>
              <Input
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Seu nome completo"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                disabled
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground">
                O email não pode ser alterado
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Telefone</Label>
              <Input
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(00) 00000-0000"
              />
            </div>
            <Button onClick={handleUpdateProfile} disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                "Salvar Alterações"
              )}
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Alterar Senha</CardTitle>
          <CardDescription>
            Atualize sua senha de acesso
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="currentPassword">Senha Atual</Label>
              <Input
                id="currentPassword"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newPassword">Nova Senha</Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar Nova Senha</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
          </div>
          <Button onClick={handleChangePassword} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Alterando...
              </>
            ) : (
              "Alterar Senha"
            )}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Integração Zoho Mail
          </CardTitle>
          <CardDescription>
            Conecte sua conta Zoho Mail para criar tarefas automaticamente quando enviar emails
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {zohoConnected ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 p-4 bg-primary/10 rounded-lg">
                <LinkIcon className="h-5 w-5 text-primary" />
                <div className="flex-1">
                  <p className="font-medium text-foreground">Conectado</p>
                  <p className="text-sm text-muted-foreground">{zohoEmail}</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Seus emails enviados pelo Zoho Mail serão automaticamente registrados como tarefas concluídas no sistema.
              </p>
              <Button 
                variant="destructive" 
                onClick={handleDisconnectZoho}
              >
                <Unlink className="mr-2 h-4 w-4" />
                Desconectar Zoho Mail
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Conecte sua conta Zoho Mail para sincronizar automaticamente seus emails enviados como tarefas no CRM.
              </p>
              <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                <li>Emails enviados viram tarefas automaticamente</li>
                <li>Sincronização em tempo real</li>
                <li>Histórico completo de comunicações</li>
              </ul>
              <Button 
                onClick={handleConnectZoho} 
                disabled={connectingZoho}
              >
                {connectingZoho ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Conectando...
                  </>
                ) : (
                  <>
                    <LinkIcon className="mr-2 h-4 w-4" />
                    Conectar com Zoho Mail
                  </>
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Configuracoes;
