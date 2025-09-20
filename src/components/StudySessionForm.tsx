import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useStudySessions } from '@/hooks/useStudySessions';
import { CalendarIcon, Clock } from 'lucide-react';

const formSchema = z.object({
  startTime: z.string().min(1, 'Start time is required'),
  endTime: z.string().optional()
}).refine((data) => {
  if (!data.endTime) return true;
  return new Date(data.startTime) < new Date(data.endTime);
}, {
  message: 'End time must be after start time',
  path: ['endTime']
});

type FormData = z.infer<typeof formSchema>;

export const StudySessionForm = () => {
  const { createSession } = useStudySessions();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      startTime: '',
      endTime: ''
    }
  });

  function toUTC(datetimeLocal: string) {
  // "2025-09-18T20:30"
    const [datePart, timePart] = datetimeLocal.split("T");
    const [year, month, day] = datePart.split("-").map(Number);
    const [hour, minute] = timePart.split(":").map(Number);

    // Create date in local time
    const localDate = new Date(year, month - 1, day, hour, minute);
    return localDate.toISOString(); // UTC ISO string
  }

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    try {
      await createSession(toUTC(data.startTime), data.endTime ? toUTC(data.endTime) : undefined);
      form.reset();
    } catch (error) {
      // Error handling
    } finally {
      setIsSubmitting(false);
    }
  };


  // const onSubmit = async (data: FormData) => {
  //   setIsSubmitting(true);
  //   try {
  //     // Convert local time to UTC explicitly
  //     const localDate = new Date(data.startTime);
  //     const utcDate = new Date(localDate.getTime() - localDate.getTimezoneOffset() * 60000);

  //     await createSession(utcDate.toISOString(), data.endTime || undefined);
  //     form.reset();
  //   } catch (error) {
  //     // Error handling
  //   } finally {
  //     setIsSubmitting(false);
  //   }
  // };


  // Get current datetime for min attribute (can't schedule in the past)
  const now = new Date();
  const minDateTime = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarIcon className="h-5 w-5" />
          Schedule Study Session
        </CardTitle>
        <CardDescription>
          Create a silent study block. You'll receive a reminder 10 minutes before it starts.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="startTime"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Start Time
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="datetime-local"
                      min={minDateTime}
                      {...field}
                      className="w-full"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="endTime"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    End Time (Optional)
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="datetime-local"
                      min={minDateTime}
                      {...field}
                      className="w-full"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button 
              type="submit" 
              className="w-full" 
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Creating...' : 'Create Study Session'}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
};