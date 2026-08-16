import { useState } from 'react';
import { useLocation } from 'react-router';
import { Button } from '../../components/Button';
import { isFeedbackEnabled, submitFeedback, type FeedbackPayload } from './feedbackClient';

type FeedbackMode = 'default' | 'comment-only';

interface FeedbackWidgetProps {
  mode?: FeedbackMode;
}

type Status = 'idle' | 'submitting' | 'sent' | 'error';

export function FeedbackWidget({ mode = 'default' }: FeedbackWidgetProps) {
  const { pathname } = useLocation();
  const [rating, setRating] = useState<FeedbackPayload['rating']>(null);
  const [comment, setComment] = useState('');
  const [status, setStatus] = useState<Status>('idle');

  if (!isFeedbackEnabled()) return null;

  async function handleSubmit() {
    setStatus('submitting');
    try {
      await submitFeedback({
        rating: mode === 'comment-only' ? null : rating,
        comment: comment.trim() || undefined,
        page: pathname,
      });
      setStatus('sent');
    } catch {
      setStatus('error');
    }
  }

  if (status === 'sent') {
    return <p className="text-sm text-muted">Thanks for the feedback.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {mode !== 'comment-only' && (
        <div className="flex gap-2">
          <button
            type="button"
            aria-pressed={rating === 'up'}
            aria-label="Thumbs up"
            onClick={() => setRating(rating === 'up' ? null : 'up')}
            className={`rounded-md border border-rule px-3 py-2 text-lg ${rating === 'up' ? 'bg-accent text-paper' : 'bg-elev text-ink hover:bg-rule'}`}
          >
            👍
          </button>
          <button
            type="button"
            aria-pressed={rating === 'down'}
            aria-label="Thumbs down"
            onClick={() => setRating(rating === 'down' ? null : 'down')}
            className={`rounded-md border border-rule px-3 py-2 text-lg ${rating === 'down' ? 'bg-accent text-paper' : 'bg-elev text-ink hover:bg-rule'}`}
          >
            👎
          </button>
        </div>
      )}
      <textarea
        value={comment}
        onChange={(event) => setComment(event.target.value)}
        placeholder="Any feedback? (optional)"
        rows={2}
        className="rounded-md border border-rule bg-paper px-3 py-2 text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      />
      {status === 'error' && (
        <p role="alert" className="text-sm text-error">
          Something went wrong. Please try again.
        </p>
      )}
      <Button
        onClick={() => void handleSubmit()}
        disabled={status === 'submitting'}
        className="self-start"
      >
        {status === 'submitting' ? 'Sending…' : 'Send feedback'}
      </Button>
    </div>
  );
}
