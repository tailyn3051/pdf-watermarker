import React, { useState, useCallback, useEffect } from 'react';
import { createRoot } from 'react-dom/client';

declare const pdfjsLib: any;
declare const JSZip: any;
declare const PDFLib: any;

type WatermarkPosition =
  | 'topLeft'
  | 'topCenter'
  | 'topRight'
  | 'centerLeft'
  | 'center'
  | 'centerRight'
  | 'bottomLeft'
  | 'bottomCenter'
  | 'bottomRight'
  | 'tile';

type Language = 'en' | 'zh-TW';

const translations = {
  en: {
    title: 'PDF',
    titleSpan: 'Watermarker',
    errorSelectPdf: 'Please select a valid PDF file.',
    errorNoImages: 'No valid image files selected.',
    errorUploadFiles: 'Please upload a PDF and at least one watermark image.',
    errorProcessing: 'An error occurred while processing the PDF. Please try again.',
    errorCreatingPdf: 'Could not generate the PDF file. Please try again.',
    uploadFiles: '1. Upload Files',
    uploadPdf: 'Click to Upload PDF',
    pdfLoaded: 'PDF Loaded',
    uploadWatermarks: 'Click to Upload Watermarks',
    watermarksLoaded: 'Watermark(s) Loaded',
    configureWatermark: '2. Configure Watermark',
    opacity: 'Opacity',
    scale: 'Scale',
    position: 'Position',
    posTopL: 'Top L',
    posTopC: 'Top C',
    posTopR: 'Top R',
    posMidL: 'Mid L',
    posCenter: 'Center',
    posMidR: 'Mid R',
    posBotL: 'Bot L',
    posBotC: 'Bot C',
    posBotR: 'Bot R',
    posTile: 'Tile',
    generateButton: 'Generate Pages',
    processingButton: 'Processing...',
    results: '3. Results',
    downloadZip: 'Download All (.zip)',
    downloadPdf: 'Download as PDF',
    creatingPdf: 'Creating PDF...',
    loaderText: 'Applying watermark to pages...',
    placeholder: 'Your watermarked pages will appear here.',
    page: 'Page',
    download: 'Download',
  },
  'zh-TW': {
    title: 'PDF',
    titleSpan: '浮水印工具',
    errorSelectPdf: '請選擇一個有效的 PDF 檔案。',
    errorNoImages: '未選擇有效的圖片檔案。',
    errorUploadFiles: '請上傳 PDF 和至少一張浮水印圖片。',
    errorProcessing: '處理 PDF 時發生錯誤，請重試。',
    errorCreatingPdf: '無法生成 PDF 檔案，請重試。',
    uploadFiles: '1. 上傳檔案',
    uploadPdf: '點擊上傳 PDF',
    pdfLoaded: '已載入 PDF',
    uploadWatermarks: '點擊上傳浮水印',
    watermarksLoaded: '個浮水印已載入',
    configureWatermark: '2. 設定浮水印',
    opacity: '不透明度',
    scale: '縮放',
    position: '位置',
    posTopL: '左上',
    posTopC: '中上',
    posTopR: '右上',
    posMidL: '左中',
    posCenter: '置中',
    posMidR: '右中',
    posBotL: '左下',
    posBotC: '中下',
    posBotR: '右下',
    posTile: '平鋪',
    generateButton: '生成頁面',
    processingButton: '處理中...',
    results: '3. 結果',
    downloadZip: '全部下載 (.zip)',
    downloadPdf: '下載為 PDF',
    creatingPdf: '正在建立 PDF...',
    loaderText: '正在為頁面應用浮水印...',
    placeholder: '您加上浮水印的頁面將會出現在這裡。',
    page: '第',
    download: '下載',
  },
};

const App: React.FC = () => {
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [watermarkFiles, setWatermarkFiles] = useState<File[]>([]);
  const [watermarkPreviewUrls, setWatermarkPreviewUrls] = useState<string[]>([]);
  const [opacity, setOpacity] = useState(0.5);
  const [scale, setScale] = useState(0.5);
  const [position, setPosition] = useState<WatermarkPosition>('center');
  const [processing, setProcessing] = useState(false);
  const [isCreatingPdf, setIsCreatingPdf] = useState(false);
  const [watermarkedPages, setWatermarkedPages] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [language, setLanguage] = useState<Language>('en');

  useEffect(() => {
    const userLang = navigator.language;
    if (userLang.startsWith('zh-TW') || userLang.startsWith('zh-Hant')) {
      setLanguage('zh-TW');
    } else {
      setLanguage('en');
    }
  }, []);

  const t = (key: keyof typeof translations.en) => {
    return translations[language][key] || translations.en[key];
  };

  const toggleLanguage = () => {
    setLanguage(prev => prev === 'en' ? 'zh-TW' : 'en');
  };

  const handlePdfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === 'application/pdf') {
      setPdfFile(file);
      setError(null);
    } else {
      setPdfFile(null);
      setError(t('errorSelectPdf'));
    }
  };

  const handleWatermarkChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const imageFiles = Array.from(files).filter(file => file.type.startsWith('image/'));
      if (imageFiles.length === 0) {
        setError(t('errorNoImages'));
        setWatermarkFiles([]);
        setWatermarkPreviewUrls([]);
        return;
      }

      setWatermarkFiles(imageFiles);
      setError(null);

      const readerPromises = imageFiles.map(file => {
        return new Promise<string>(resolve => {
          const reader = new FileReader();
          reader.onloadend = () => {
            resolve(reader.result as string);
          };
          reader.readAsDataURL(file);
        });
      });

      Promise.all(readerPromises).then(newUrls => {
        setWatermarkPreviewUrls(newUrls);
      });
    } else {
      setWatermarkFiles([]);
      setWatermarkPreviewUrls([]);
    }
  };

  const applyWatermark = useCallback(async () => {
    if (!pdfFile || watermarkFiles.length === 0) {
      setError(t('errorUploadFiles'));
      return;
    }

    setProcessing(true);
    setWatermarkedPages([]);
    setError(null);

    try {
      const pdfData = await pdfFile.arrayBuffer();
      const watermarkImages = await Promise.all(
        watermarkFiles.map(file => {
          return new Promise<HTMLImageElement>(resolve => {
            const watermarkImage = new Image();
            watermarkImage.src = URL.createObjectURL(file);
            watermarkImage.onload = () => resolve(watermarkImage);
          });
        })
      );

      const pdf = await pdfjsLib.getDocument({ data: pdfData }).promise;
      const numPages = pdf.numPages;
      const pages: string[] = [];

      for (let i = 1; i <= numPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 2.0 }); // Higher scale for better quality
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        await page.render({ canvasContext: context, viewport: viewport }).promise;
        
        context.globalAlpha = opacity;
        
        for (const watermarkImage of watermarkImages) {
            const watermarkWidth = watermarkImage.width * scale;
            const watermarkHeight = watermarkImage.height * scale;
            
            if (position === 'tile') {
              for (let y = -watermarkHeight; y < canvas.height; y += watermarkHeight * 1.5) {
                for (let x = -watermarkWidth; x < canvas.width; x += watermarkWidth * 1.5) {
                     context.save();
                     context.translate(x + watermarkWidth / 2, y + watermarkHeight / 2);
                     context.rotate(-Math.PI / 4);
                     context.drawImage(watermarkImage, -watermarkWidth/2, -watermarkHeight/2, watermarkWidth, watermarkHeight);
                     context.restore();
                }
              }
            } else {
                let x = 0, y = 0;
                // X positions
                if (position.includes('Center')) x = (canvas.width - watermarkWidth) / 2;
                if (position.includes('Right')) x = canvas.width - watermarkWidth - 20;
                if (position.includes('Left') && !position.includes('center')) x = 20;
                if (position === 'centerLeft') x = 20;

                // Y positions
                if (position.startsWith('top')) y = 20;
                if (position.startsWith('center')) y = (canvas.height - watermarkHeight) / 2;
                if (position.startsWith('bottom')) y = canvas.height - watermarkHeight - 20;

                context.drawImage(watermarkImage, x, y, watermarkWidth, watermarkHeight);
            }
        }
        
        pages.push(canvas.toDataURL('image/png'));
      }
      setWatermarkedPages(pages);
    // Fix: Explicitly type the caught error as `any` to prevent type errors.
    } catch (err: any) {
      console.error(err);
      setError(t('errorProcessing'));
    } finally {
      setProcessing(false);
    }
  }, [pdfFile, watermarkFiles, opacity, scale, position, language]);
  
  const handleDownloadAll = async () => {
    if (watermarkedPages.length === 0) return;
    const zip = new JSZip();
    watermarkedPages.forEach((dataUrl, i) => {
        const base64Data = dataUrl.split(',')[1];
        zip.file(`page_${i + 1}.png`, base64Data, { base64: true });
    });

    const content = await zip.generateAsync({ type: 'blob' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(content);
    link.download = 'watermarked_pages.zip';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  const handleDownloadAsPdf = async () => {
    if (watermarkedPages.length === 0) return;

    setIsCreatingPdf(true);
    setError(null);

    try {
        const { PDFDocument } = PDFLib;
        const pdfDoc = await PDFDocument.create();

        for (const dataUrl of watermarkedPages) {
            const pngImageBytes = await fetch(dataUrl).then(res => res.arrayBuffer());
            const pngImage = await pdfDoc.embedPng(pngImageBytes);
            const page = pdfDoc.addPage([pngImage.width, pngImage.height]);
            page.drawImage(pngImage, {
                x: 0,
                y: 0,
                width: pngImage.width,
                height: pngImage.height,
            });
        }

        const pdfBytes = await pdfDoc.save();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'watermarked_document.pdf';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    // Fix: Explicitly type the caught error as `any` to prevent type errors.
    } catch (err: any) {
        console.error("Failed to create PDF", err);
        setError(t('errorCreatingPdf'));
    } finally {
        setIsCreatingPdf(false);
    }
};

  const positionOptions: { id: WatermarkPosition, label: keyof typeof translations.en }[] = [
      { id: 'topLeft', label: 'posTopL' },
      { id: 'topCenter', label: 'posTopC' },
      { id: 'topRight', label: 'posTopR' },
      { id: 'centerLeft', label: 'posMidL' },
      { id: 'center', label: 'posCenter' },
      { id: 'centerRight', label: 'posMidR' },
      { id: 'bottomLeft', label: 'posBotL' },
      { id: 'bottomCenter', label: 'posBotC' },
      { id: 'bottomRight', label: 'posBotR' },
      { id: 'tile', label: 'posTile' },
  ];

  return (
    <div className="container">
      <header className="app-header">
        <h1 className="title">{t('title')} <span>{t('titleSpan')}</span></h1>
        <button onClick={toggleLanguage} className="lang-toggle">
            {language === 'en' ? '繁' : 'EN'}
        </button>
      </header>
      {error && <p className="error-message">{error}</p>}
      <div className="main-content">
        <aside className="controls-panel">
          <div className="upload-section">
            <h2>{t('uploadFiles')}</h2>
            <div className="file-input-wrapper">
              <span>{pdfFile ? t('pdfLoaded') : t('uploadPdf')}</span>
              <input type="file" accept="application/pdf" onChange={handlePdfChange} />
              {pdfFile && <p className="file-name">{pdfFile.name}</p>}
            </div>
            <div className="file-input-wrapper">
              <span>{watermarkFiles.length > 0 ? `${watermarkFiles.length} ${t('watermarksLoaded')}` : t('uploadWatermarks')}</span>
              <input type="file" accept="image/*" onChange={handleWatermarkChange} multiple />
              {watermarkFiles.length > 0 && <p className="file-name">{watermarkFiles.map(f => f.name).join(', ')}</p>}
            </div>
            {watermarkPreviewUrls.length > 0 && (
                <div className="watermark-preview-grid">
                  {watermarkPreviewUrls.map((url, index) => (
                    <img key={index} src={url} alt={`Watermark Preview ${index + 1}`} />
                  ))}
                </div>
            )}
          </div>

          <div className="settings-section">
            <h2>{t('configureWatermark')}</h2>
            <div className="setting">
              <label htmlFor="opacity">{t('opacity')}: <span className="value">{(opacity * 100).toFixed(0)}%</span></label>
              <input type="range" id="opacity" className="slider" min="0" max="1" step="0.05" value={opacity} onChange={(e) => setOpacity(parseFloat(e.target.value))} />
            </div>
            <div className="setting">
              <label htmlFor="scale">{t('scale')}: <span className="value">{(scale * 100).toFixed(0)}%</span></label>
              <input type="range" id="scale" className="slider" min="0.1" max="2" step="0.05" value={scale} onChange={(e) => setScale(parseFloat(e.target.value))} />
            </div>
            <div className="setting">
              <label>{t('position')}:</label>
              <div className="position-grid">
                {positionOptions.map(opt => (
                    <div key={opt.id}>
                        <input type="radio" name="position" id={opt.id} value={opt.id} checked={position === opt.id} onChange={(e) => setPosition(e.target.value as WatermarkPosition)} />
                        <label htmlFor={opt.id}>{t(opt.label)}</label>
                    </div>
                ))}
              </div>
            </div>
          </div>
          
          <button className="generate-btn" onClick={applyWatermark} disabled={!pdfFile || watermarkFiles.length === 0 || processing || isCreatingPdf}>
            {processing ? t('processingButton') : t('generateButton')}
          </button>
          <p className="version-info">ver-0.1</p>
        </aside>

        <main className="results-panel">
            <div className="results-header">
                <h2>{t('results')}</h2>
                <div className="results-actions">
                    <button 
                      className="download-all-btn" 
                      onClick={handleDownloadAll}
                      disabled={watermarkedPages.length === 0 || processing || isCreatingPdf}
                    >
                      {t('downloadZip')}
                    </button>
                    <button
                      className="download-pdf-btn"
                      onClick={handleDownloadAsPdf}
                      disabled={watermarkedPages.length === 0 || processing || isCreatingPdf}
                    >
                        {isCreatingPdf ? t('creatingPdf') : t('downloadPdf')}
                    </button>
                </div>
            </div>
          {processing ? (
            <div className="loader-container">
                <div className="loader"></div>
                <p>{t('loaderText')}</p>
            </div>
          ) : watermarkedPages.length > 0 ? (
            <div className="image-grid">
              {watermarkedPages.map((src, index) => (
                <div key={index} className="image-card">
                  <img src={src} alt={`${t('page')} ${index + 1}`} />
                  <div className="overlay">
                      <p className="page-number">{t('page')} {index + 1}</p>
                      <a href={src} download={`page_${index + 1}.png`} className="download-btn">{t('download')}</a>
                  </div>
                </div>
              ))}
            </div>
          ) : (
             <div className="placeholder">
                <p>{t('placeholder')}</p>
             </div>
          )}
        </main>
      </div>
    </div>
  );
};

const container = document.getElementById('root');
const root = createRoot(container!);
root.render(<App />);