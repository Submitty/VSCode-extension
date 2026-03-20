// src/services/apiClient.ts

import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';

export class ApiClient {
  private client: AxiosInstance;

  constructor(
    baseURL: string = '',
    defaultHeaders: Record<string, string> = {}
  ) {
    this.client = axios.create({
      baseURL,
      headers: {
        'Content-Type': 'application/json',
        ...defaultHeaders,
      },
      timeout: 30000, // 30 seconds timeout
    });

    // Request interceptor
    this.client.interceptors.request.use(
      config => {
        // Add any request logging or modification here
        return config;
      },
      (error: Error) => {
        return Promise.reject(new Error(error.message || 'Request failed'));
      }
    );

    // Response interceptor
    this.client.interceptors.response.use(
      response => {
        return response;
      },
      (error: Error) => {
        // Handle common errors here
        return Promise.reject(new Error(error.message || 'Response failed'));
      }
    );
  }

  /**
   * Set the base URL for all requests
   */
  setBaseURL(baseURL: string): void {
    this.client.defaults.baseURL = baseURL;
  }

  /**
   * Set default headers for all requests
   */
  setDefaultHeaders(headers: Record<string, string>): void {
    this.client.defaults.headers.common = {
      ...this.client.defaults.headers.common,
      ...headers,
    };
  }

  /**
   * Set the Authorization token for all requests
   */
  setToken(token: string): void {
    this.client.defaults.headers.common['Authorization'] = `${token}`;
  }

  /**
   * GET request
   */
  async get<T = any>(
    url: string,
    config?: AxiosRequestConfig
  ): Promise<AxiosResponse<T>> {
    return this.client.get<T>(url, config);
  }

  /**
   * POST request
   */
  async post<T = any>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<AxiosResponse<T>> {
    return this.client.post<T>(url, data, config);
  }

  /**
   * PUT request
   */
  async put<T = any>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<AxiosResponse<T>> {
    return this.client.put<T>(url, data, config);
  }

  /**
   * PATCH request
   */
  async patch<T = any>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<AxiosResponse<T>> {
    return this.client.patch<T>(url, data, config);
  }

  /**
   * DELETE request
   */
  async delete<T = any>(
    url: string,
    config?: AxiosRequestConfig
  ): Promise<AxiosResponse<T>> {
    return this.client.delete<T>(url, config);
  }

  /**
   * HEAD request
   */
  async head<T = any>(
    url: string,
    config?: AxiosRequestConfig
  ): Promise<AxiosResponse<T>> {
    return this.client.head<T>(url, config);
  }

  /**
   * OPTIONS request
   */
  async options<T = any>(
    url: string,
    config?: AxiosRequestConfig
  ): Promise<AxiosResponse<T>> {
    return this.client.options<T>(url, config);
  }

  /**
   * Get the underlying axios instance for advanced usage
   */
  getAxiosInstance(): AxiosInstance {
    return this.client;
  }
}
