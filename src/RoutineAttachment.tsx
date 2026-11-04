import { useEffect, useState } from 'react';
import { FileText, ChevronLeft, ChevronRight } from 'lucide-react';
import { fileBlob, type LocalFile } from './files';
import { Native, isNative } from './native';
import { tr } from './deen-ui';
export function RoutineAttachment({ file, open }: { file: LocalFile; open: () => void }) {
  const [url, setUrl] = useState(''),
    [page, setPage] = useState(0),
    [pages, setPages] = useState(1),
    [error, setError] = useState('');
  useEffect(() => {
    let disposed = false,
      objectUrl = '';
    setError('');
    setUrl('');
    void (async () => {
      try {
        if (isNative && file.mime === 'application/pdf') {
          const preview = await Native.deen({ op: 'pdfPreview', path: file.path, page });
          if (!disposed) {
            setUrl('data:image/png;base64,' + preview.base64);
            setPages(preview.pages);
          }
        } else {
          objectUrl = URL.createObjectURL(await fileBlob(file));
          if (!disposed) setUrl(objectUrl);
        }
      } catch {
        if (!disposed)
          setError(
            tr(
              'Preview unavailable. Open the attachment to read it.',
              'جھلک دستیاب نہیں۔ فائل کھولیں۔',
              'المعاينة غير متاحة. افتح المرفق للقراءة.',
            ),
          );
      }
    })();
    return () => {
      disposed = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [file.id, file.path, page]);
  return (
    <section
      className="linked-reading"
      aria-label={tr('Attached reading', 'منسلک مطالعہ', 'القراءة المرفقة')}
    >
      <div className="linked-reading-title">
        <FileText size={16} />
        <strong>{file.name}</strong>
      </div>
      {error ? (
        <p role="status">{error}</p>
      ) : url ? (
        file.mime === 'application/pdf' && !isNative ? (
          <iframe src={url} title={file.name} />
        ) : (
          <button
            className="attachment-image"
            onClick={open}
            aria-label={tr('Open reading', 'مطالعہ کھولیں', 'فتح القراءة')}
          >
            <img
              src={url}
              alt={
                file.mime === 'application/pdf'
                  ? tr('PDF page', 'پی ڈی ایف صفحہ', 'صفحة الملف')
                  : file.name
              }
            />
          </button>
        )
      ) : (
        <p role="status">{tr('Loading reading…', 'مطالعہ کھل رہا ہے…', 'جارٍ فتح القراءة…')}</p>
      )}
      <div className="attachment-controls">
        {isNative && file.mime === 'application/pdf' && pages > 1 && (
          <>
            <button
              className="icon"
              aria-label={tr('Previous page', 'پچھلا صفحہ', 'الصفحة السابقة')}
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft size={18} />
            </button>
            <span dir="ltr">
              {page + 1}/{pages}
            </span>
            <button
              className="icon"
              aria-label={tr('Next page', 'اگلا صفحہ', 'الصفحة التالية')}
              disabled={page + 1 >= pages}
              onClick={() => setPage((p) => p + 1)}
            >
              <ChevronRight size={18} />
            </button>
          </>
        )}
        <button className="secondary" onClick={open}>
          {file.mime === 'application/pdf'
            ? tr('Read PDF', 'پی ڈی ایف پڑھیں', 'قراءة الملف')
            : tr('Read image', 'تصویر پڑھیں', 'قراءة الصورة')}
        </button>
      </div>
    </section>
  );
}
