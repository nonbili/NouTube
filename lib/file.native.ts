import { File, Paths } from 'expo-file-system/next'

export async function saveFile(filename: string, content: string) {
  const file = new File(Paths.cache, filename)
  try {
    file.create()
    file.write(content)
    await shareAsync(file.uri, {
      mimeType: 'text/plain',
      dialogTitle: 'Save the file',
    })
  } catch (e) {
    console.error(e)
  }
}
