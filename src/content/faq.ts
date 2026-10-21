export const faqs = [
  {
    question: 'What does "resize PDF" mean?',
    answer:
      'It can mean changing PDF page dimensions or reducing the file\'s storage size. This tool changes page dimensions, such as A4, Letter, or custom sizes.',
  },
  {
    question: 'Can I resize a PDF to A4?',
    answer: 'Yes. Choose A4 as the target page size, select a fitting mode, and resize the document.',
  },
  {
    question: 'Can I set a custom PDF page size?',
    answer: 'Yes. Enter the desired width and height and select millimeters, centimeters, or inches.',
  },
  {
    question: 'Will resizing reduce my PDF file size?',
    answer:
      'Not necessarily. Changing page dimensions is different from compressing a PDF. The output file may be similar in size or may change depending on the document and processing method.',
  },
  {
    question: 'Will resizing crop my content?',
    answer:
      'Fit is designed to keep content visible, while Fill may crop content and Stretch may distort it. Review the selected mode before processing.',
  },
  {
    question: 'Is resizing a PDF the same as cropping it?',
    answer:
      'No. Resizing changes the page dimensions and scales the content onto that page. Cropping would trim the visible area without giving the page a new paper size. This tool resizes the page. It does not crop a selected region.',
  },
  {
    question: 'Can I resize a PDF with mixed page sizes?',
    answer:
      'Yes. Every page is resized to the single page size you select. Pages that originally had different sizes all use that same size.',
  },
  {
    question: 'Is my PDF uploaded to a server?',
    answer: 'No. Your PDF is processed locally in your browser and is not uploaded to our server.',
  },
  {
    question: 'Does this tool compress PDFs to a specific KB or MB size?',
    answer: 'No. This tool changes page dimensions rather than targeting a file-size limit.',
  },
] as const;

export const pageTitle = 'Resize PDF Online Free – Change PDF Page Size';

export const pageDescription =
  'Resize PDF pages to A4, A3, A5, Letter, Legal, or custom dimensions. Choose how your content fits, then download your resized PDF.';
