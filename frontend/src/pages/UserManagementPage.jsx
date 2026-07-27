import { useState, useEffect, useCallback } from 'react';
import { getUsers, deleteUser, updateUser } from '../services/apiUser';
import Swal from 'sweetalert2';
import { cn } from '../lib/utils';

// ── Helper Components ─────────────────────────────────────────────────────────

const RoleBadge = ({ role }) => {
  const roleStyles = {
    admin: 'bg-indigo-100 text-indigo-700',
    engineer: 'bg-sky-100 text-sky-700',
    user: 'bg-slate-100 text-slate-600',
  };
  return (
    <span className={cn(
      'px-2.5 py-1 text-xs font-semibold rounded-full capitalize',
      roleStyles[role.toLowerCase()] || roleStyles.user
    )}>
      {role}
    </span>
  );
};

const Avatar = ({ username }) => {
  const initial = username ? username.charAt(0).toUpperCase() : '?';
  return (
    <div className="w-9 h-9 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-500 text-sm flex-shrink-0">
      {initial}
    </div>
  );
};

const Pagination = ({ currentPage, totalPages, onPageChange, totalUsers, limit }) => {
  if (totalPages <= 1) return null;

  const pageNumbers = [];
  const delta = 1;
  const left = currentPage - delta;
  const right = currentPage + delta + 1;
  let last;

  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= left && i < right)) {
      if (last && i - last !== 1) {
        pageNumbers.push('...');
      }
      pageNumbers.push(i);
      last = i;
    }
  }

  const startUser = totalUsers > 0 ? (currentPage - 1) * limit + 1 : 0;
  const endUser = Math.min(currentPage * limit, totalUsers);

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between px-6 py-3 bg-white border-t border-gray-200">
      <p className="text-xs text-gray-600 mb-2 sm:mb-0">
        Showing <span className="font-semibold">{startUser}</span> to <span className="font-semibold">{endUser}</span> of <span className="font-semibold">{totalUsers}</span> results
      </p>
      <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span className="sr-only">Previous</span>
          <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fillRule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clipRule="evenodd" /></svg>
        </button>
        {pageNumbers.map((page, index) =>
          typeof page === 'number' ? (
            <button
              key={index}
              onClick={() => onPageChange(page)}
              aria-current={page === currentPage ? 'page' : undefined}
              className={cn(
                "relative inline-flex items-center px-4 py-2 text-xs font-semibold",
                page === currentPage
                  ? "z-10 bg-indigo-600 text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                  : "text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0"
              )}
            >
              {page}
            </button>
          ) : (
            <span key={index} className="relative inline-flex items-center px-4 py-2 text-xs font-semibold text-gray-700 ring-1 ring-inset ring-gray-300">...</span>
          )
        )}
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span className="sr-only">Next</span>
          <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" /></svg>
        </button>
      </nav>
    </div>
  );
};

function UserManagementPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalUsers: 0,
  });
  const USER_LIMIT = 10;

  useEffect(() => {
    const timerId = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
      if (pagination.currentPage !== 1) {
        setPagination(p => ({ ...p, currentPage: 1 }));
      }
    }, 500);

    return () => clearTimeout(timerId);
  }, [searchTerm, pagination.currentPage]);

  const fetchUsers = useCallback(async (page, search) => {
    try {
      setLoading(true);
      const data = await getUsers({ page, limit: USER_LIMIT, search });
      setUsers(data.users);
      setPagination({
        currentPage: data.currentPage,
        totalPages: data.totalPages,
        totalUsers: data.totalUsers,
      });
      setError(null);
    } catch (err) {
      setError(err.message || 'Failed to fetch users.');
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers(pagination.currentPage, debouncedSearchTerm);
  }, [fetchUsers, pagination.currentPage, debouncedSearchTerm]);

  const handleDelete = async (userId, username) => {
    const result = await Swal.fire({
      title: 'Are you sure?',
      text: `You are about to delete user "${username}". This action cannot be undone.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Yes, delete it!',
      customClass: {
        popup: 'rounded-2xl',
      }
    });

    if (result.isConfirmed) {
      try {
        const response = await deleteUser(userId);
        Swal.fire({
          title: 'Deleted!',
          text: response.message || 'User has been deleted.',
          icon: 'success',
          timer: 1500,
          showConfirmButton: false,
          customClass: { popup: 'rounded-2xl' }
        });
        if (users.length === 1 && pagination.currentPage > 1) {
          setPagination(p => ({ ...p, currentPage: p.currentPage - 1 }));
        } else {
          fetchUsers(pagination.currentPage, debouncedSearchTerm);
        }
      } catch (err) {
        Swal.fire({
          title: 'Error!',
          text: err.message || 'Failed to delete user.',
          icon: 'error',
          customClass: { popup: 'rounded-2xl' }
        });
      }
    }
  };

  const handleEditPlant = async (user) => {
    const { value: newPlant } = await Swal.fire({
      title: `Edit Plant for ${user.en}`,
      input: 'text',
      inputValue: user.plant,
      inputPlaceholder: 'Enter new plant name',
      showCancelButton: true,
      confirmButtonText: 'Save Changes',
      customClass: { popup: 'rounded-2xl' },
      inputValidator: (value) => {
        if (!value || value.trim() === '') {
          return 'Plant name cannot be empty!';
        }
      }
    });

    if (newPlant && newPlant.trim() !== user.plant) {
      try {
        const { message, user: updatedUser } = await updateUser(user.id, { plant: newPlant.trim() });
        Swal.fire({
          title: 'Success!',
          text: message,
          icon: 'success',
          timer: 1500,
          showConfirmButton: false,
          customClass: { popup: 'rounded-2xl' }
        });
        setUsers(currentUsers =>
          currentUsers.map(u => (u.id === user.id ? { ...u, plant: updatedUser.plant } : u))
        );
      } catch (err) {
        Swal.fire({
          title: 'Error!',
          text: err.message,
          icon: 'error',
          customClass: { popup: 'rounded-2xl' }
        });
      }
    }
  };

  if (loading) {
    return (
      <div className="flex-1 overflow-y-auto bg-gray-50 min-h-0 flex items-center justify-center">
        <div className="flex items-center gap-2 text-gray-500">
          <svg className="w-6 h-6 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle className="opacity-25" cx="12" cy="12" r="10" strokeWidth={4}/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/></svg>
          <span className="font-medium">Loading users...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 overflow-y-auto bg-gray-50 min-h-0 flex items-center justify-center p-8">
        <div className="max-w-md rounded-2xl border border-red-200 bg-white p-6 text-center shadow-sm">
          <svg className="w-12 h-12 mx-auto text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><path d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/></svg>
          <p className="mt-4 text-sm font-bold text-red-600">Failed to load users</p>
          <p className="mt-2 text-sm text-gray-600">{error}</p>
          <button // Changed to use fetchUsers with current state
            onClick={fetchUsers}
            className="mt-4 rounded-xl bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 active:scale-95"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto min-h-0">
      <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">User Management</h1>
            <p className="text-sm text-gray-500 mt-1">Manage all user accounts in the system.</p>
          </div>
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input
              type="text"
              placeholder="Search users..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full sm:w-64 pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>
        </div>

        {/* User Table */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">User</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Role</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Plant</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Created At</th>
                  <th scope="col" className="relative px-6 py-3"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {!loading && users.length > 0 ? users.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <Avatar username={user.role} />
                        <div className="text-sm font-medium text-gray-900">{user.en}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <RoleBadge role={user.role} />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{user.plant}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(user.createdAt).toLocaleDateString('en-GB')}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleEditPlant(user)}
                          className="p-2 rounded-lg text-gray-400 hover:bg-indigo-100 hover:text-indigo-600 transition-colors"
                          aria-label="Edit user"
                        >
                          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </button>
                        <button 
                          onClick={() => handleDelete(user.id, user.en)} 
                          disabled={user.role === 'admin'} 
                          className="p-2 rounded-lg text-gray-400 hover:bg-red-100 hover:text-red-600 disabled:text-gray-300 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-colors"
                          aria-label="Delete user"
                        >
                          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan="5" className="text-center py-12 px-6 text-gray-500">
                      {loading ? (
                        <div className="flex items-center justify-center gap-2"><svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle className="opacity-25" cx="12" cy="12" r="10" strokeWidth={4}/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/></svg><span>Loading...</span></div>
                      ) : (
                        <>
                          <svg className="w-12 h-12 mx-auto text-gray-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
                          <p className="mt-4 text-sm font-semibold">No users found</p>
                          <p className="mt-1 text-xs">{debouncedSearchTerm ? 'Try adjusting your search.' : 'There are no users in the system yet.'}</p>
                        </>
                      )}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <Pagination
            currentPage={pagination.currentPage}
            totalPages={pagination.totalPages}
            totalUsers={pagination.totalUsers}
            limit={USER_LIMIT}
            onPageChange={(page) => setPagination(p => ({ ...p, currentPage: page }))}
          />
        </div>
      </div>
    </div>
  );
}

export default UserManagementPage;