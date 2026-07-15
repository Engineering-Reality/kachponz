import type { FastifyRequest, FastifyReply } from 'fastify';
import { watchTask } from '../../services/a2aTasks.js';
import { txLogger } from '../../lib/logger.js';

export async function streamHandler(req: FastifyRequest, reply: FastifyReply) {
  const { id: taskId } = req.params as { id: string };
  const log = txLogger('stream-handler').child({ taskId });

  reply.raw.setHeader('Content-Type', 'text/event-stream');
  reply.raw.setHeader('Cache-Control', 'no-cache');
  reply.raw.setHeader('Connection', 'keep-alive');
  reply.raw.setHeader('Access-Control-Allow-Origin', '*'); // Opsional bila butuh CORS

  reply.raw.flushHeaders();

  const controller = new AbortController();

  req.raw.on('close', () => {
    log.info('SSE Client disconnected');
    controller.abort();
  });

  try {
    await watchTask(
      taskId,
      (task) => {
        const payload = JSON.stringify({
          taskId: task.id,
          transactionId: task.transaction_id,
          step: task.step,
          state: task.state,
          submittedBy: task.submitted_by,
          assigneeHint: task.assignee_hint,
          correlationId: task.correlation_id,
          inputRequiredMsg: task.input_required_msg,
          resultData: task.result_data,
          failReason: task.fail_reason,
          createdAt: task.created_at.toISOString(),
          updatedAt: task.updated_at.toISOString()
        });
        
        reply.raw.write(`event: update\n`);
        reply.raw.write(`data: ${payload}\n\n`);
        
        // Fastify raw access, sometimes needs flush
        if ((reply.raw as any).flush) {
          (reply.raw as any).flush();
        }
      },
      controller.signal
    );
  } catch (err: any) {
    log.error({ err }, 'Error in SSE stream');
    if (!controller.signal.aborted) {
      reply.raw.write(`event: error\n`);
      reply.raw.write(`data: ${JSON.stringify({ message: err.message || 'Stream error' })}\n\n`);
      reply.raw.end();
    }
  }

  // Keep connection open indefinitely unless aborted
  await new Promise((resolve) => {
    controller.signal.addEventListener('abort', resolve);
  });
}
