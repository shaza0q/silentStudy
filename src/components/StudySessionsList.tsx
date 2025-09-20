import { useStudySessions } from '@/hooks/useStudySessions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CalendarIcon, Clock, Trash2 } from 'lucide-react';
import { format } from 'date-fns';

export const StudySessionsList = () => {
  const { sessions, loading, deleteSession } = useStudySessions();

  if (loading) {
    return <div className="text-center py-4">Loading your study sessions...</div>;
  }

  if (sessions.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-muted-foreground">
            <CalendarIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No study sessions scheduled yet.</p>
            <p className="text-sm">Create your first silent study block above!</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const upcomingSessions = sessions.filter(session => 
    new Date(session.start_time) > new Date()
  );

  const pastSessions = sessions.filter(session => 
    new Date(session.start_time) <= new Date()
  );

  return (
    <div className="space-y-6">
      {upcomingSessions.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Upcoming Sessions
          </h3>
          <div className="space-y-3">
            {upcomingSessions.map((session) => (
              <SessionCard key={session.id} session={session} onDelete={deleteSession} />
            ))}
          </div>
        </div>
      )}

      {pastSessions.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <CalendarIcon className="h-5 w-5" />
            Past Sessions
          </h3>
          <div className="space-y-3">
            {pastSessions.map((session) => (
              <SessionCard key={session.id} session={session} onDelete={deleteSession} isPast />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const SessionCard = ({ 
  session, 
  onDelete, 
  isPast = false 
}: { 
  session: any; 
  onDelete: (id: string) => void;
  isPast?: boolean;
}) => {
  const startTime = new Date(session.start_time);
  const endTime = session.end_time ? new Date(session.end_time) : null;
  
  return (
    <Card className={isPast ? 'opacity-75' : ''}>
      <CardContent className="pt-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              <span className="font-medium">
                {format(startTime, 'MMM d, yyyy • h:mm a')}
              </span>
              {session.reminder_sent && (
                <Badge variant="secondary" className="text-xs">
                  Reminder Sent
                </Badge>
              )}
            </div>
            
            {endTime && (
              <div className="text-sm text-muted-foreground ml-6">
                Until {format(endTime, 'h:mm a')}
              </div>
            )}
            
            {isPast && (
              <Badge variant="outline" className="ml-6">
                Completed
              </Badge>
            )}
          </div>
          
          {!isPast && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDelete(session.id)}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};