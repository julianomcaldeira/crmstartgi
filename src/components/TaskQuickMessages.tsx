import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";

interface TaskQuickMessagesProps {
  taskType: string;
  onSelect: (message: string) => void;
}

const TaskQuickMessages = ({ taskType, onSelect }: TaskQuickMessagesProps) => {
  const [messages, setMessages] = useState<string[]>([]);

  useEffect(() => {
    fetchMessages();
  }, [taskType]);

  const fetchMessages = async () => {
    try {
      const { data, error } = await supabase
        .from("task_message_templates")
        .select("message")
        .eq("task_type", taskType)
        .order("message");

      if (error) throw error;
      setMessages(data?.map((d) => d.message) || []);
    } catch (error) {
      console.error("Error fetching quick messages:", error);
    }
  };

  if (messages.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5">
      {messages.map((msg, idx) => (
        <Badge
          key={idx}
          variant="secondary"
          className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors text-xs px-2 py-1"
          onClick={() => onSelect(msg)}
        >
          {msg}
        </Badge>
      ))}
    </div>
  );
};

export default TaskQuickMessages;
