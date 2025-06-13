// ====== الكود النهائي والصحيح - المرحلة الثانية ======

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.11.338/pdf.worker.min.js`;

const fileInput = document.getElementById('pdf-file-input');
const pdfViewer = document.getElementById('pdf-viewer');
const loadingSpinner = document.getElementById('loading-spinner');

fileInput.addEventListener('change', handleFileSelect, false);

function handleFileSelect(event) {
    const file = event.target.files[0];
    if (file && file.type === 'application/pdf') {
        const fileReader = new FileReader();
        fileReader.onload = function() {
            const typedarray = new Uint8Array(this.result);
            renderAndHighlightPdf(typedarray);
        };
        fileReader.readAsArrayBuffer(file);
    } else {
        alert('الرجاء اختيار ملف PDF صالح.');
    }
}

async function renderAndHighlightPdf(pdfData) {
    pdfViewer.innerHTML = '';
    loadingSpinner.style.display = 'block';

    try {
        const pdf = await pdfjsLib.getDocument(pdfData).promise;
        
        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
            const page = await pdf.getPage(pageNum);
            const viewport = page.getViewport({ scale: 2.5 });

            const canvas = document.createElement('canvas');
            canvas.className = 'pdf-page-canvas';
            const context = canvas.getContext('2d');
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            pdfViewer.appendChild(canvas);

            await page.render({ canvasContext: context, viewport: viewport }).promise;

            const textContent = await page.getTextContent();
            if (textContent.items.length === 0) continue;

            // ================== !! الجزء الأهم: ضع الأرقام هنا !! ==================
            // استخدم الأرقام التي وجدتها في المرحلة الأولى
            // سنضع نطاقاً حول الرقم لضمان الدقة (مثلاً الرقم ± 20)

            // لنفترض أن X لـ '206 VO' كان 345
            const column2_X_start = 325; // 345 - 20
            const column2_X_end = 365;   // 345 + 20
            
            // لنفترض أن X لـ '21003467' كان 449
            const column3_X_start = 429; // 449 - 20
            const column3_X_end = 469;   // 449 + 20
            // ====================================================================

            const lines = groupTextByLines(textContent.items);

            lines.forEach(line => {
                let highlightColor = null;

                const column3Items = line.items.filter(item => item.transform[4] > column3_X_start && item.transform[4] < column3_X_end);
                if (column3Items.some(item => item.str.includes('21003467'))) {
                    highlightColor = 'rgba(40, 167, 69, 0.4)'; // Green
                } else {
                    const column2Items = line.items.filter(item => item.transform[4] > column2_X_start && item.transform[4] < column2_X_end);
                    if (column2Items.some(item => item.str.includes('206 VO'))) {
                         highlightColor = 'rgba(220, 53, 69, 0.4)'; // Red
                    }
                }
                
                if (highlightColor) {
                    context.fillStyle = highlightColor;
                    const lineBounds = getLineBounds(line.items, viewport);
                    if (lineBounds) {
                        context.fillRect(lineBounds.x, lineBounds.y, lineBounds.width, lineBounds.height);
                    }
                }
            });
        }
    } catch (error) {
        console.error('خطأ أثناء معالجة ملف PDF:', error);
        alert('حدث خطأ أثناء قراءة الملف. قد يكون الملف تالفًا أو غير مدعوم.');
    } finally {
        loadingSpinner.style.display = 'none';
    }
}

function groupTextByLines(items, tolerance = 5) {
    const lines = [];
    if (!items || items.length === 0) return lines;
    const sortedItems = [...items].sort((a, b) => a.transform[5] - b.transform[5]);
    let currentLine = { y: sortedItems[0].transform[5], items: [] };
    sortedItems.forEach(item => {
        if (item.str.trim() === '') return;
        if (Math.abs(item.transform[5] - currentLine.y) < tolerance) {
            currentLine.items.push(item);
        } else {
            if(currentLine.items.length > 0) lines.push(currentLine);
            currentLine = { y: item.transform[5], items: [item] };
        }
    });
    if(currentLine.items.length > 0) lines.push(currentLine);
    return lines;
}

function getLineBounds(lineItems, viewport) {
    if (!lineItems || lineItems.length === 0) return null;
    lineItems.sort((a, b) => a.transform[4] - b.transform[4]);
    const firstItem = lineItems[0];
    const x = 0;
    const y = firstItem.transform[5] - (firstItem.height * 1.1);
    const width = viewport.width;
    const height = Math.max(...lineItems.map(i => i.height)) * 1.5;
    return { x, y, width, height };
}
