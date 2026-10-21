interface ProcessingStatusProps {
  message: string;
}

export default function ProcessingStatus({ message }: ProcessingStatusProps) {
  return (
    <p className="status" role="status" aria-live="polite">
      {message}
    </p>
  );
}
