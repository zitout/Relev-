// تحديد العامل لـ PDF.js - هذا السطر ضروري
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.11.338/pdf.worker.min.js`;

// الحصول على عناصر الواجهة من ملف HTML
const fileInput = document.getElementById('pdf-file-input');
const pdfViewer = document.getElementById('pdf-viewer');
const loadingSpinner = document.getElementById('loading-spinner');

// عند اختيار المستخدم لملف جديد، يتم تشغيل هذه الدالة
fileInput.addEventListener('change', handleFileSelect, false);

/**
 * تقرأ الملف الذي اختاره المستخدم وتحوله إلى صيغة مناسبة لمكتبة PDF.js.
 * @param {Event} event - حدث اختيار الملف.
 */
function handleFileSelect(event) {
    const file = event.target.files[0];
    if (file && file.type === 'application/pdf') {
        const fileReader = new FileReader();
        fileReader.onload = function() {
            const typedarray = new Uint8Array(this.result);
            // استدعاء الدالة الرئيسية لعرض وتلوين الـ PDF
            renderAndHighlightPdf(typedarray);
        };
        fileReader.readAsArrayBuffer(file);
    } else {
        alert('الرجاء اختيار ملف PDF صالح.');
    }
}

/**
 * الدالة الرئيسية التي تقوم بعرض صفحات الـ PDF وتطبيق قواعد التلوين.
 * @param {Uint8Array} pdfData - بيانات ملف الـ PDF.
 */
async function renderAndHighlightPdf(pdfData) {
    // إفراغ العارض السابق وإظهار مؤشر التحميل
    pdfViewer.innerHTML = '';
    loadingSpinner.style.display = 'block';

    try {
        // تحميل ملف الـ PDF باستخدام المكتبة
        const pdf = await pdfjsLib.getDocument(pdfData).promise;
        
        // المرور على كل صفحة في الملف
        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
            const page = await pdf.getPage(pageNum);
            
            // !! تعديل الجودة: زدنا الدقة إلى 2.5 للحصول على صورة شديدة الوضوح !!
            const viewport = page.getViewport({ scale: 2.5 });

            // إنشاء عنصر canvas لكل صفحة
            const canvas = document.createElement('canvas');
            canvas.className = 'pdf-page-canvas';
            const context = canvas.getContext('2d');
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            pdfViewer.appendChild(canvas);

            // عرض محتوى الصفحة على الـ canvas
            await page.render({ canvasContext: context, viewport: viewport }).promise;

            // استخراج النصوص ومواقعها من الصفحة
            const textContent = await page.getTextContent();
            
            // !! تعديل الدقة: تحديد إحداثيات الأعمدة الصحيحة !!
            // هذه الأرقام تم تقديرها بناءً على هيكل ملفك.
            // يمكنك تعديلها إذا لزم الأمر بعد إجراء التشخيص كما شرحت سابقاً.
            const column2_X_start = 330; // بداية العمود الثاني (الذي يحتوي على 206 VO)
            const column2_X_end = 400;   // نهاية العمود الثاني
            const column3_X_start = 430; // بداية العمود الثالث (الذي يحتوي على 21003467)
            const column3_X_end = 550;   // نهاية العمود الثالث

            // تجميع النصوص المتفرقة في أسطر منطقية
            const lines = groupTextByLines(textContent.items);

            // المرور على كل سطر لتطبيق قواعد التلوين
            lines.forEach(line => {
                let highlightColor = null;

                // القاعدة 1 (الأولوية للأخضر): البحث في العمود الثالث
                const column3Items = line.items.filter(item => item.transform[4] > column3_X_start && item.transform[4] < column3_X_end);
                if (column3Items.some(item => item.str.includes('21003467'))) {
                    highlightColor = 'rgba(40, 167, 69, 0.4)'; // أخضر شفاف
                } 
                // القاعدة 2 (الأحمر): إذا لم تتحقق القاعدة 1، نبحث هنا
                else {
                    const column2Items = line.items.filter(item => item.transform[4] > column2_X_start && item.transform[4] < column2_X_end);
                    if (column2Items.some(item => item.str.includes('206 VO'))) {
                         highlightColor = 'rgba(220, 53, 69, 0.4)'; // أحمر شفاف
                    }
                }
                
                // إذا كان هناك لون للتظليل، نقوم برسم مستطيل فوق السطر
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
        // إخفاء مؤشر التحميل عند الانتهاء
        loadingSpinner.style.display = 'none';
    }
}

/**
 * دالة مساعدة لتجميع النصوص في أسطر بناءً على موقعها الرأسي.
 * @param {Array} items - مصفوفة النصوص من PDF.js.
 * @param {number} tolerance - مقدار التفاوت المسموح به في المحور الرأسي (y) لاعتبار النصوص في نفس السطر.
 * @returns {Array} مصفوفة من الأسطر، كل سطر يحتوي على النصوص الخاصة به.
 */
function groupTextByLines(items, tolerance = 5) {
    const lines = [];
    if (!items || items.length === 0) return lines;

    // فرز العناصر من الأعلى إلى الأسفل لتسهيل التجميع
    const sortedItems = [...items].sort((a, b) => a.transform[5] - b.transform[5]);
    
    let currentLine = { y: sortedItems[0].transform[5], items: [] };

    sortedItems.forEach(item => {
        // إذا كان العنصر قريبًا رأسيًا من السطر الحالي، أضفه إليه
        if (Math.abs(item.transform[5] - currentLine.y) < tolerance) {
            currentLine.items.push(item);
        } else {
            // وإلا، احفظ السطر الحالي وابدأ سطرًا جديدًا
            if(currentLine.items.length > 0) lines.push(currentLine);
            currentLine = { y: item.transform[5], items: [item] };
        }
    });
    // إضافة السطر الأخير
    if(currentLine.items.length > 0) lines.push(currentLine);
    return lines;
}

/**
 * دالة مساعدة للحصول على أبعاد المستطيل الذي سيتم رسمه لتظليل السطر.
 * @param {Array} lineItems - مصفوفة النصوص التي تشكل سطراً واحداً.
 * @param {Object} viewport - معلومات أبعاد الصفحة.
 * @returns {Object|null} كائن يحتوي على إحداثيات وأبعاد المستطيل (x, y, width, height).
 */
function getLineBounds(lineItems, viewport) {
    if (!lineItems || lineItems.length === 0) return null;
    
    // ترتيب عناصر السطر من اليسار إلى اليمين
    lineItems.sort((a, b) => a.transform[4] - b.transform[4]);

    const firstItem = lineItems[0];
    const x = 0; // تظليل عرض السطر كاملاً من بداية الصفحة
    const y = firstItem.transform[5] - (firstItem.height * 1.1); // حساب بداية السطر من الأعلى
    const width = viewport.width; // بعرض الصفحة بالكامل
    const height = Math.max(...lineItems.map(i => i.height)) * 1.5; // ارتفاع مناسب للسطر
    
    return { x, y, width, height };
}
