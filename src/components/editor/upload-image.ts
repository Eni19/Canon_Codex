/** Opens a native file picker and uploads the chosen image, invoking `onUploaded` with the new assetId. */
export function triggerImageUpload(onUploaded: (assetId: string) => void): void {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/png,image/jpeg,image/webp,image/gif'
  input.addEventListener('change', () => {
    const file = input.files?.[0]
    if (!file) return

    const formData = new FormData()
    formData.set('file', file)

    fetch('/api/assets', { method: 'POST', body: formData })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error('Upload failed'))))
      .then((data: { assetId: string }) => onUploaded(data.assetId))
      .catch(() => {
        // Best-effort: a failed upload simply leaves the editor unchanged.
      })
  })
  input.click()
}
