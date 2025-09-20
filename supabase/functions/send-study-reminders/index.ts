import { serve } from "https://deno.land/std/http/mod.ts";
import { createClient } from "https://deno.land/x/supabase@2.0.0/mod.ts";
import { Resend } from "npm:resend@2.0.0";

// For Deno, ensure you have --allow-env flag enabled when running the script.
// If you are using Deno, this line is correct, but you may need to run with permissions.
// If you are using Node.js, replace with: process.env.RESEND_API_KEY
const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  console.log("Starting study session reminder cron job at", new Date().toISOString());

  try {
    // Initialize Supabase client with service role key for admin access
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Calculate the time window for reminders (10 minutes from now, +/- 1 minute window)
    const now = new Date();
    const windowStart = new Date(now.getTime() + 10 * 60 * 1000); // 10 minutes from now
    const windowEnd = new Date(windowStart.getTime() + 60 * 1000); // +1 minute window

    console.log(`Looking for sessions between ${windowStart.toISOString()} and ${windowEnd.toISOString()}`);

    // Find candidate sessions that need reminders
    const { data: candidateSessions, error: fetchError } = await supabase
      .from('study_sessions')
      .select(`
        id,
        user_id,
        start_time,
        end_time,
        reminder_sent,
        reminder_attempts
      `)
      .gte('start_time', windowStart.toISOString())
      .lt('start_time', windowEnd.toISOString())
      .eq('reminder_sent', false)
      .limit(500);

    if (fetchError) {
      console.error('Error fetching candidate sessions:', fetchError);
      throw fetchError;
    }

    if (!candidateSessions || candidateSessions.length === 0) {
      console.log('No sessions found that need reminders');
      return new Response(JSON.stringify({ message: 'No sessions to remind' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`Found ${candidateSessions.length} candidate sessions`);

    // Group sessions by user_id to send one email per user
    const userSessionsMap = new Map<string, any[]>();

    // Atomically claim each session
    for (const session of candidateSessions) {
      const { data: claimedSession, error: claimError } = await supabase
        .from('study_sessions')
        .update({
          reminder_sent: true,
          reminder_sent_at: now.toISOString(),
          reminder_attempts: session.reminder_attempts + 1
        })
        .eq('id', session.id)
        .eq('reminder_sent', false) // Only claim if not already claimed
        .select()
        .single();

      if (claimError) {
        console.log(`Failed to claim session ${session.id}:`, claimError);
        continue; // Someone else claimed it or it was already processed
      }

      if (!claimedSession) {
        console.log(`Session ${session.id} was already claimed by another process`);
        continue;
      }

      console.log(`Successfully claimed session ${session.id}`);

      // Add to user sessions map
      const userId = claimedSession.user_id;
      if (!userSessionsMap.has(userId)) {
        userSessionsMap.set(userId, []);
      }
      userSessionsMap.get(userId)!.push(claimedSession);
    }

    if (userSessionsMap.size === 0) {
      console.log('No sessions were successfully claimed');
      return new Response(JSON.stringify({ message: 'No sessions were claimed' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`Processing ${userSessionsMap.size} users for email reminders`);

    // Send one email per user
    let emailsSent = 0;
    let emailsFailed = 0;

    for (const [userId, sessions] of userSessionsMap.entries()) {
      try {
        // Get user email from auth.users table
        const { data: userData, error: userError } = await supabase.auth.admin.getUserById(userId);
        
        if (userError || !userData.user?.email) {
          console.error(`Failed to get user email for ${userId}:`, userError);
          await revertClaims(supabase, sessions);
          emailsFailed++;
          continue;
        }

        const userEmail = userData.user.email;
        
        // Create email content
        const emailHtml = createReminderEmail(sessions, userData.user);
        
        // Send email via Resend
        const emailResponse = await resend.emails.send({
          from: "Study Reminder <noreply@yourdomain.com>",
          to: [userEmail],
          subject: `Reminder: Your study session${sessions.length > 1 ? 's' : ''} start${sessions.length === 1 ? 's' : ''} in 10 minutes`,
          html: emailHtml,
        });

        if (emailResponse.error) {
          console.error(`Failed to send email to ${userEmail}:`, emailResponse.error);
          await revertClaims(supabase, sessions);
          emailsFailed++;
        } else {
          console.log(`Successfully sent reminder email to ${userEmail} for ${sessions.length} session(s)`);
          emailsSent++;
        }

      } catch (error) {
        console.error(`Error processing user ${userId}:`, error);
        await revertClaims(supabase, sessions);
        emailsFailed++;
      }
    }

    const result = {
      message: `Processed ${candidateSessions.length} sessions, sent ${emailsSent} emails, ${emailsFailed} failed`,
      emailsSent,
      emailsFailed,
      sessionsProcessed: candidateSessions.length
    };

    console.log('Cron job completed:', result);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('Error in send-study-reminders function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
};

// Helper function to revert claims on email failure
async function revertClaims(supabase: any, sessions: any[]) {
  const sessionIds = sessions.map(s => s.id);
  await supabase
    .from('study_sessions')
    .update({
      reminder_sent: false,
      reminder_sent_at: null
    })
    .in('id', sessionIds);
  
  console.log(`Reverted claims for ${sessionIds.length} sessions due to email failure`);
}

// Helper function to create reminder email HTML
function createReminderEmail(sessions: any[], user: any): string {
  const userName = user.user_metadata?.name || user.email;
  const sessionCount = sessions.length;
  
  let sessionsList = '';
  sessions.forEach(session => {

    const formatter = new Intl.DateTimeFormat("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Asia/Kolkata",
    });

    const startTime = new Date(session.start_time).toLocaleString();

    const endTime = session.end_time ? new Date(session.end_time) : null;
    
    sessionsList += `
      <div style="background: #f8f9fa; padding: 15px; margin: 10px 0; border-radius: 8px; border-left: 4px solid #007bff;">
        <div style="font-weight: bold; color: #333;">
          📚 ${startTime.toLocaleString()}
        </div>
        ${endTime ? `<div style="color: #666; font-size: 14px; margin-top: 5px;">Until ${endTime.toLocaleString()}</div>` : ''}
      </div>
    `;
  });

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Study Session Reminder</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="margin: 0; font-size: 28px;">🔔 Study Session Reminder</h1>
        <p style="margin: 10px 0 0 0; opacity: 0.9;">Your silent study block${sessionCount > 1 ? 's' : ''} start${sessionCount === 1 ? 's' : ''} in 10 minutes!</p>
      </div>
      
      <div style="background: white; padding: 30px; border: 1px solid #e1e5e9; border-radius: 0 0 10px 10px;">
        <p>Hi ${userName},</p>
        
        <p>This is a friendly reminder that your study session${sessionCount > 1 ? 's' : ''} will begin in approximately <strong>10 minutes</strong>.</p>
        
        <div style="margin: 25px 0;">
          <h3 style="color: #333; margin-bottom: 15px;">Your Upcoming Session${sessionCount > 1 ? 's' : ''}:</h3>
          ${sessionsList}
        </div>
        
        <div style="background: #e3f2fd; padding: 20px; border-radius: 8px; margin: 25px 0;">
          <h4 style="margin: 0 0 10px 0; color: #1976d2;">💡 Tips for Your Study Session:</h4>
          <ul style="margin: 0; padding-left: 20px;">
            <li>Find a quiet, comfortable space</li>
            <li>Put your phone in silent mode</li>
            <li>Have water and any needed materials ready</li>
            <li>Take deep breaths and focus on your goals</li>
          </ul>
        </div>
        
        <p style="color: #666; font-size: 14px; margin-top: 30px;">
          Good luck with your study session! Stay focused and make the most of your dedicated time.
        </p>
        
        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
        
        <p style="color: #999; font-size: 12px; text-align: center;">
          This is an automated reminder from your Study Session app.<br>
          You're receiving this because you scheduled a study block that starts soon.
        </p>
      </div>
    </body>
    </html>
  `;
}

serve(handler);