export interface BranchDto {
  id: string;
  name: string;
  code: string;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  phone?: string | null;
  email?: string | null;
  timezone: string;
  currency: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBranchDto {
  name: string;
  code: string;
  address?: string;
  city?: string;
  country?: string;
  phone?: string;
  email?: string;
  timezone?: string;
  currency?: string;
}

export interface UpdateBranchDto extends Partial<CreateBranchDto> {
  isActive?: boolean;
}
