export interface Gradable {
    id: string
    title: string
    instructions_url: string
    gradeable_type: string
    syllabus_bucket: string
    section: number
    section_name: string
    due_date: DueDate
    vcs_repository: string
    vcs_subdirectory: string
}

export interface DueDate {
    date: string
    timezone_type: number
    timezone: string
}
