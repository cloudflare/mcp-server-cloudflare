export async function get_file_name_from_path(path: string): Promise<string> {
	path = path.replace('/files/contents', '')
	path = path.endsWith('/') ? path.substring(0, path.length - 1) : path

	return path
}
