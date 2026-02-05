export type ProjectState = {
  projectId: string | null;
  activeFileId: string | null;
};

export const initialProjectState: ProjectState = {
  projectId: null,
  activeFileId: null
};
