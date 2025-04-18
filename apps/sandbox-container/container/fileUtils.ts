import * as fs from 'node:fs/promises'
import path from 'node:path'
import mime from 'mime'

// this is because there isn't a "real" directory mime type, so we're reusing the "text/directory" mime type
// so claude doesn't give an error
export const DIRECTORY_CONTENT_TYPE = 'text/directory'

export async function get_file_name_from_path(path: string): Promise<string> {
	path = path.replace('/files/contents', '')
	path = path.endsWith('/') ? path.substring(0, path.length - 1) : path

	return path
}

export async function list_files_in_directory(dirPath: string): Promise<string[]> {
	const files: string[] = []
	try {
		const dir = await fs.readdir(path.join(process.cwd(), dirPath), {
			withFileTypes: true,
		})
		for (const dirent of dir) {
			const relPath = path.relative(process.cwd(), `${dirPath}/${dirent.name}`)
			files.push(`file:///${relPath}`)
		}
	} catch (error) {
		throw new Error('Failed to read directory')
	}

	return files
}

export async function get_mime_type(path: string): Promise<string | null> {
	let mimeType = mime.getType(path)
	if (mimeType && mimeType === 'inode/directory') {
		mimeType = DIRECTORY_CONTENT_TYPE
	}
	return mimeType
}
