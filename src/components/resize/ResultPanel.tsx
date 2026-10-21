interface ResultPanelProps {
  url: string;
  filename: string;
  onReset: () => void;
}

export default function ResultPanel({ url, filename, onReset }: ResultPanelProps) {
  return (
    <section className="result" aria-label="Resized PDF">
      <h2>Your resized PDF is ready</h2>
      <p>Download the file, change the settings and resize again, or start over with another PDF.</p>
      <div className="result-actions">
        <a className="button" href={url} download={filename}>
          Download resized PDF
        </a>
        <button type="button" className="button button-secondary" onClick={onReset}>
          Resize another PDF
        </button>
      </div>
    </section>
  );
}
