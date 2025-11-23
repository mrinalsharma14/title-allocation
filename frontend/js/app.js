class App {
    constructor() {
        this.currentUser = null;
        this.apiCache = window.apiCache;

        // Wait for auth to be ready before initializing
        this.waitForAuthAndInit();
    }

    async waitForAuthAndInit() {
        // Wait until auth check is complete
        while (!window.auth || !window.auth.user) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        this.currentUser = window.auth.user;
        this.init();
    }

    init() {
        console.log('App initialized with caching');
        this.checkAuthStatus();
        this.initGlobalListeners();

        // Preload common data if user is logged in
        if (this.currentUser) {
            setTimeout(() => {
                this.apiCache.preloadCommonData();
            }, 1000);
        }
    }

    checkAuthStatus() {
        const user = JSON.parse(localStorage.getItem('user') || 'null');
        const token = localStorage.getItem('token');

        if (user && token) {
            this.currentUser = user;
            console.log(`User authenticated: ${user.name} (${user.role})`);
        } else {
            console.log('No user authenticated');
        }
    }

    initGlobalListeners() {
        console.log('Initializing global listeners with caching support');

        // Global logout handler to clear cache
        $(document).on('click', '#logout-btn', () => {
            console.log('Logout clicked - clearing cache');
            this.apiCache.clearAll();
        });

        // Preload data when navigating to different sections
        $(document).on('click', '.dashboard-card', (e) => {
            const cardId = $(e.currentTarget).attr('id');
            console.log(`Dashboard card clicked: ${cardId}`);

            setTimeout(() => {
                this.apiCache.preloadCommonData();
            }, 500);
        });

        // Handle browser back/forward navigation
        $(window).on('popstate', () => {
            console.log('Navigation detected - refreshing cache if needed');
            setTimeout(() => {
                this.apiCache.preloadCommonData();
            }, 300);
        });

        // Handle online/offline status for cache management
        $(window).on('online', () => {
            console.log('Browser online - refreshing stale cache');
            this.refreshStaleCache();
        });

        $(window).on('offline', () => {
            console.log('Browser offline - relying on cached data');
            this.showOfflineWarning();
        });

        // Periodic cache maintenance (every 10 minutes)
        setInterval(() => {
            this.performCacheMaintenance();
        }, 10 * 60 * 1000);
    }

    // Enhanced API call with caching and error handling
    async apiCall(url, options = {}) {
        const startTime = Date.now();

        try {
            console.log(`[API] Making request to: ${url}`);
            const data = await this.apiCache.call(url, options);
            const duration = Date.now() - startTime;
            console.log(`[API] Request completed in ${duration}ms: ${url}`);
            return data;
        } catch (error) {
            const duration = Date.now() - startTime;
            console.error(`[API] Request failed after ${duration}ms: ${url}`, error);

            // Check if we have cached data to fall back to
            const cacheKey = this.apiCache.cacheManager.generateKey(url, options.data);
            const cachedData = this.apiCache.cacheManager.get(cacheKey);

            if (cachedData && this.isNetworkError(error)) {
                console.log(`[API] Using cached data as fallback for: ${url}`);
                this.showWarning('Using cached data (offline mode)');
                return cachedData;
            }

            throw error;
        }
    }

    // Check if error is network-related
    isNetworkError(error) {
        return !navigator.onLine ||
            error.message.includes('Network') ||
            error.message.includes('Failed to fetch') ||
            error.status === 0;
    }

    // Show offline warning
    showOfflineWarning() {
        const existingWarning = $('.offline-warning');
        if (existingWarning.length > 0) return;

        const warningHtml = `
            <div class="offline-warning fixed top-4 right-4 bg-yellow-500 text-white px-6 py-3 rounded-lg shadow-lg z-50 flex items-center">
                <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.35 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
                </svg>
                You are currently offline. Using cached data.
            </div>
        `;
        $('body').append(warningHtml);

        // Auto-remove when online
        const checkOnline = setInterval(() => {
            if (navigator.onLine) {
                $('.offline-warning').remove();
                clearInterval(checkOnline);
            }
        }, 1000);
    }

    // Show temporary warning message
    showWarning(message) {
        const warningHtml = `
            <div class="temp-warning fixed top-4 right-4 bg-yellow-500 text-white px-6 py-3 rounded-lg shadow-lg z-50">
                ${message}
            </div>
        `;
        $('body').append(warningHtml);

        setTimeout(() => {
            $('.temp-warning').remove();
        }, 3000);
    }

    // Refresh stale cache when coming online
    async refreshStaleCache() {
        console.log('[Cache] Refreshing stale cache entries');
        const user = JSON.parse(localStorage.getItem('user') || 'null');
        if (!user) return;

        const urlsToRefresh = [
            '/api/system-settings',
            '/api/users/supervisors'
        ];

        if (user.role === 'student') {
            urlsToRefresh.push('/api/titles');
            urlsToRefresh.push('/api/preferences');
            urlsToRefresh.push('/api/allocations');
        } else if (user.role === 'admin') {
            urlsToRefresh.push('/api/titles');
            urlsToRefresh.push('/api/users');
            urlsToRefresh.push('/api/custom-titles');
            urlsToRefresh.push('/api/allocations');
        }

        // Refresh in background without blocking UI
        urlsToRefresh.forEach(url => {
            this.apiCache.call(url).then(() => {
                console.log(`[Cache] Refreshed: ${url}`);
            }).catch(error => {
                console.warn(`[Cache] Refresh failed for ${url}:`, error);
            });
        });
    }

    // Periodic cache maintenance
    performCacheMaintenance() {
        console.log('[Cache] Performing periodic maintenance');

        // Clean up expired entries
        window.cacheManager.cleanupExpired();

        // Check cache size and warn if too large
        const stats = window.cacheManager.getStats();
        if (stats.totalEntries > 100) {
            console.warn(`[Cache] Large cache detected: ${stats.totalEntries} entries, ${stats.totalSize}`);
        }

        // Preload data if user is active
        if (this.currentUser && document.hasFocus()) {
            this.apiCache.preloadCommonData();
        }
    }

    // Show loading spinner
    showLoading(container) {
        const loadingHtml = `
            <div class="text-center py-8">
                <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
                <p class="mt-4 text-gray-600">Loading...</p>
            </div>
        `;
        if (container) {
            $(container).html(loadingHtml);
        }
        return loadingHtml;
    }

    // Show loading spinner with message
    showLoadingWithMessage(container, message = 'Loading...') {
        const loadingHtml = `
            <div class="text-center py-8">
                <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
                <p class="mt-4 text-gray-600">${message}</p>
            </div>
        `;
        if (container) {
            $(container).html(loadingHtml);
        }
        return loadingHtml;
    }

    // Show error message
    showError(message, container) {
        const errorHtml = `
            <div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                <div class="flex items-center">
                    <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.35 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
                    </svg>
                    <strong>Error:</strong> ${message}
                </div>
            </div>
        `;
        if (container) {
            $(container).html(errorHtml);
        }
        return errorHtml;
    }

    // Show success message
    showSuccess(message, container) {
        const successHtml = `
            <div class="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
                <div class="flex items-center">
                    <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                    </svg>
                    ${message}
                </div>
            </div>
        `;
        if (container) {
            $(container).html(successHtml);
        }
        return successHtml;
    }

    // Show info message
    showInfo(message, container) {
        const infoHtml = `
            <div class="bg-blue-100 border border-blue-400 text-blue-700 px-4 py-3 rounded">
                <div class="flex items-center">
                    <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                    ${message}
                </div>
            </div>
        `;
        if (container) {
            $(container).html(infoHtml);
        }
        return infoHtml;
    }

    // Debounced API call for search inputs
    createDebouncedApiCall(delay = 300) {
        let timeoutId;

        return (url, options, callback) => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(async () => {
                try {
                    const data = await this.apiCall(url, options);
                    callback(null, data);
                } catch (error) {
                    callback(error, null);
                }
            }, delay);
        };
    }

    // Get cache statistics (useful for debugging)
    getCacheStats() {
        return window.cacheManager.getStats();
    }

    // Clear specific cache entries by pattern
    clearCacheByPattern(pattern) {
        const keys = Object.keys(localStorage);
        let clearedCount = 0;

        keys.forEach(key => {
            if (key.includes(pattern)) {
                window.cacheManager.remove(key);
                clearedCount++;
            }
        });

        console.log(`[Cache] Cleared ${clearedCount} entries matching pattern: ${pattern}`);
        return clearedCount;
    }

    // Preload data for specific user role
    preloadRoleSpecificData(role) {
        console.log(`[Cache] Preloading data for role: ${role}`);

        const preloadUrls = {
            student: [
                '/api/titles',
                '/api/preferences',
                '/api/allocations',
                '/api/system-settings',
                '/api/users/supervisors'
            ],
            supervisor: [
                '/api/titles',
                '/api/allocations',
                '/api/system-settings'
            ],
            admin: [
                '/api/titles',
                '/api/users',
                '/api/custom-titles',
                '/api/allocations',
                '/api/system-settings',
                '/api/preferences/all',
                '/api/capacity-conflicts/conflicts'
            ]
        };

        const urls = preloadUrls[role] || [];
        urls.forEach(url => {
            this.apiCache.call(url).catch(error => {
                console.warn(`[Cache] Preload failed for ${url}:`, error);
            });
        });
    }
}

// Enhanced AJAX error handler with caching support
$(document).ajaxError(function (event, jqxhr, settings, thrownError) {
    console.error(`AJAX Error: ${settings.url}`, {
        status: jqxhr.status,
        statusText: jqxhr.statusText,
        response: jqxhr.responseText
    });

    // Handle unauthorized errors
    if (jqxhr.status === 401) {
        console.log('Unauthorized - redirecting to login');
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.reload();
        return;
    }

    // Handle forbidden errors
    if (jqxhr.status === 403) {
        SweetAlert.error('You do not have permission to perform this action.');
        return;
    }

    // Handle server errors
    if (jqxhr.status >= 500) {
        const errorMessage = 'Server error. Please try again later.';

        // Check if we have cached data for this request
        const cacheKey = window.cacheManager.generateKey(settings.url);
        const cachedData = window.cacheManager.get(cacheKey);

        if (cachedData) {
            console.log('Server error - using cached data as fallback');
            SweetAlert.warning('Server temporarily unavailable. Using cached data.');
        } else {
            SweetAlert.error(errorMessage);
        }
        return;
    }

    // Handle network errors
    if (jqxhr.status === 0 || !navigator.onLine) {
        const cacheKey = window.cacheManager.generateKey(settings.url);
        const cachedData = window.cacheManager.get(cacheKey);

        if (cachedData) {
            console.log('Network error - using cached data as fallback');
            SweetAlert.warning('Network connection lost. Using cached data.');
        } else {
            SweetAlert.error('Network error. Please check your connection.');
        }
        return;
    }
});

// Initialize the app when document is ready
$(document).ready(() => {
    // Don't initialize if window.app already exists
    if (!window.app) {
        window.app = new App();

        // Add app to window for debugging
        if (typeof console !== 'undefined') {
            console.log('App instance created and available as window.app');
        }
    }

    // Add cache stats to console for debugging
    if (typeof console !== 'undefined' && window.app) {
        console.log('Cache stats:', window.app.getCacheStats());
    }
});

// Export for module systems (if needed)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = App;
}