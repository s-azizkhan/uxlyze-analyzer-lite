export interface ReportConfig {
    includePSI: boolean;
    skipUrlFetch: boolean;
    includePreview: boolean;
    includeAIAnalysis: boolean;
}

export interface ReportData {
    id: string;
    user_id: string;
    project_id: string;
    title: string;
    web_url: string;
    report_config: ReportConfig;
    status: string;
    created_at: string;
    updated_at: string;
}
