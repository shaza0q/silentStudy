import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface StudySession {
  id: string;
  user_id: string;
  start_time: string;
  end_time: string | null;
  reminder_sent: boolean;
  reminder_sent_at: string | null;
  reminder_attempts: number;
  created_at: string;
  updated_at: string;
}

export const useStudySessions = () => {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<StudySession[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchSessions = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('study_sessions')
        .select('*')
        .order('start_time', { ascending: true });

      if (error) throw error;
      setSessions(data || []);
    } catch (error: any) {
      toast.error('Failed to fetch study sessions');
      console.error('Error fetching sessions:', error);
    } finally {
      setLoading(false);
    }
  };

  const createSession = async (startTime: string, endTime?: string) => {
    if (!user) {
      toast.error('You must be logged in to create a study session');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('study_sessions')
        .insert({
          user_id: user.id,
          start_time: startTime,
          end_time: endTime || null
        })
        .select()
        .single();

      if (error) throw error;
      
      setSessions(prev => [...prev, data]);
      toast.success('Study session created successfully!');
      return data;
    } catch (error: any) {
      toast.error('Failed to create study session');
      console.error('Error creating session:', error);
      throw error;
    }
  };

  const deleteSession = async (id: string) => {
    try {
      const { error } = await supabase
        .from('study_sessions')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      setSessions(prev => prev.filter(session => session.id !== id));
      toast.success('Study session deleted');
    } catch (error: any) {
      toast.error('Failed to delete study session');
      console.error('Error deleting session:', error);
    }
  };

  useEffect(() => {
    if (user) {
      fetchSessions();
    }
  }, [user]);

  return {
    sessions,
    loading,
    createSession,
    deleteSession,
    refetch: fetchSessions
  };
};