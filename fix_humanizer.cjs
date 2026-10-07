const fs = require('fs');

let content = fs.readFileSync('src/pages/Humanizer.jsx', 'utf8');

// The exact block to remove
const block = `  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef(null)

  const handleDragOver = useCallback((e) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])
  const handleDragLeave = useCallback((e) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])
  const handleDrop = useCallback(async (e) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (!file) return
    try {
      const text = await extractTextFromFile(file)
      setInput(text)
      showToast('File loaded', \`Loaded \${file.name} successfully\`, 'success')
    } catch (err) {
      showToast('Upload failed', err.message, 'error')
    }
  }, [showToast])
  const handleFileSelect = useCallback(async (e) => {
    const file = e.target.files[0]
    if (!file) return
    try {
      const text = await extractTextFromFile(file)
      setInput(text)
      showToast('File loaded', \`Loaded \${file.name} successfully\`, 'success')
    } catch (err) {
      showToast('Upload failed', err.message, 'error')
    }
    // reset input so same file can be selected again
    e.target.value = ''
  }, [showToast])\n\n`;

content = content.replace(block, '');

const insertAfter = `  const showToast = useCallback((title, message, type = 'info') => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    setToast({ title, message, type })
    toastTimerRef.current = setTimeout(() => setToast(null), 5000)
  }, [])\n\n`;

content = content.replace(insertAfter, insertAfter + block);

fs.writeFileSync('src/pages/Humanizer.jsx', content, 'utf8');
console.log("Fixed TDZ error");
