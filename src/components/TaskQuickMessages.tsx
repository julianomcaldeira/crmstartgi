import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";

interface TaskQuickMessagesProps {
  taskType: string;
  onSelect: (message: string) => void;
}

const TaskQuickMessages = ({ taskType, onSelect }: TaskQuickMessagesProps) => {
  const [messages, setMessages] = useState<{ id: string; message: string; usage_count: number }[]>([]);

  useEffect(() => {
    fetchMessages();
  }, [taskType]);

  const fetchMessages = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Fetch both global and personal messages for this task type
      const { data, error } = await supabase
        .from("task_message_templates")
        .select("id, message, usage_count, is_personal")
        .eq("task_type", taskType)
        .or(`is_personal.eq.false,created_by.eq.${user?.id}`)
        .order("usage_count", { ascending: false })
        .order("message");

      if (error) throw error;
      setMessages(data || []);
    } catch (error) {
      console.error("Error fetching quick messages:", error);
    }
  };

  const handleSelect = async (msg: { id: string; message: string }) => {
    // Increment usage count
    try {
      await supabase
        .from("task_message_templates")
        .update({ usage_count: messages.find(m => m.id === msg.id)?.usage_count ?? 0 + 1 })
        .eq("id", msg.id);
    } catch (error) {
      console.error("Error updating usage count:", error);
    }

    onSelect(msg.message);
  };

  if (messages.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5">
      {messages.map((msg) => (
        <Badge
          key={msg.id}
          variant="secondary"
          className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors text-xs px-2 py-1"
          onClick={() => handleSelect(msg)}
        >
          {msg.message}
          {msg.usage_count > 0 && (
            <span className="ml-1 opacity-60">({msg.usage_count})</span>
          )}
        </Badge>
      ))}
    </div>
  );
};

export default TaskQuickMessages;
