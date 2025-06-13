// تحديد العامل لـ PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.11.338/pdf.worker.min.js`;

// الحصول على عناصر الواجهة
const fileInput = document.getElementById('pdf-file-input');
const pdfViewer = document.getElementById('pdf-viewer');
const loadingSpinner = document.getElementById('loading-spinner');

// الاستماع لحدث اختيار ملف
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
    // إفراغ العارض السابق وإظهار مؤشر التحميل
    pdfViewer.innerHTML = '';
    loadingSpinner.style.display = 'block';

    try {
        const pdf = await pdfjsLib.getDocument(pdfData).promise;
        
        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
            const page = await pdf.getPage(pageNum);
            const viewport = page.getViewport({ scale: 1.5 });

            // إنشاء عنصر canvas لكل صفحة
            const canvas = document.createElement('canvas');
            canvas.className = 'pdf-page-canvas';
            const context = canvas.getContext('2d');
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            pdfViewer.appendChild(canvas);

            // عرض الصفحة على الـ canvas
            await page.render({ canvasContext: context, viewport: viewport }).promise;

            // استخراج النص وتطبيق التلوين
            const textContent = await page.getTextContent();
            
            // تحديد الأعمدة بشكل تقريبي
            // هذه الأرقام قد تحتاج تعديل حسب هيكل ملفك
            // X=0 هو يسار الصفحة
            const column2_X_start = 200; // بداية العمود الثاني بالبكسل
            const column2_X_end = 300;   // نهاية العمود الثاني
            const column3_X_start = 300; // بداية العمود الثالث
            const column3_X_end = 450;   // نهاية العمود الثالث

            // تجميع النصوص في أسطر بناءً على موقعها الرأسي (y)
            const lines = groupTextByLines(textContent.items);

            // المرور على كل سطر لتطبيق القواعد
            lines.forEach(line => {
                const lineText = line.items.map(item => item.str).join(' ');
                let highlightColor = null;

                // القاعدة 1 (الأولوية للأخضر): البحث في العمود الثالث
                const column3Items = line.items.filter(item => item.transform[4] > column3_X_start && item.transform[4] < column3_X_end);
                if (column3Items.some(item => item.str.includes('21003467'))) {
                    highlightColor = 'rgba(40, 167, 69, 0.3)'; // أخضر شفاف
                } 
                // القاعدة 2 (الأحمر): البحث في العمود الثاني
                else {
                    const column2Items = line.items.filter(item => item.transform[4] > column2_X_start && item.transform[4] < column2_X_end);
                    if (column2Items.some(item => item.str.includes('206 VO'))) {
                         highlightColor = 'rgba(220, 53, 69, 0.3)'; // أحمر شفاف
                    }
                }
                
                // إذا وجدنا لونًا للتظليل، نقوم برسم المستطيل
                if (highlightColor) {
                    context.fillStyle = highlightColor;
                    const [x, y, width, height] = getLineBounds(line, viewport);
                    context.fillRect(x, y, width, height);
                }
            });
        }
    } catch (error) {
        console.error('خطأ أثناء معالجة ملف PDF:', error);
        alert('حدث خطأ أثناء قراءة الملف. قد يكون الملف تالفًا.');
    } finally {
        // إخفاء مؤشر التحميل
        loadingSpinner.style.display = 'none';
    }
}

// دالة مساعدة لتجميع النصوص في أسطر
function groupTextByLines(items) {
    const lines = [];
    if (items.length === 0) return lines;

    let currentLine = { y: items[0].transform[5], items: [] };

    items.forEach(item => {
        // إذا كان العنصر قريبًا رأسيًا من السطر الحالي، أضفه إليه
        if (Math.abs(item.transform[5] - currentLine.y) < 5) {
            currentLine.items.push(item);
        } else {
            // وإلا، ابدأ سطرًا جديدًا
            lines.push(currentLine);
            currentLine = { y: item.transform[5], items: [item] };
        }
    });
    lines.push(currentLine); // إضافة السطر الأخير
    return lines;
}

// دالة مساعدة للحصول على أبعاد السطر لرسم المستطيل
function getLineBounds(line, viewport) {
    const x = 0; // بداية من يسار الصفحة
    const y = line.items[0].transform[5] - (line.items[0].height * 0.8);
    const width = viewport.width;
    const height = Math.max(...line.items.map(i => i.height)) * 1.2;
    return [x, y, width, height];
}
