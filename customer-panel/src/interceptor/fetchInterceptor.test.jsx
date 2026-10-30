import axios from 'axios';
import service from './fetchInterceptor';
import { API_BASE_URL } from '../config/AppConfig';
import store from '../redux/store';
jest.mock('../redux/store',()=>({__esModule:true,default:{dispatch:jest.fn()}}));
beforeEach(()=>{jest.restoreAllMocks();store.dispatch.mockClear();});
test('concurrent expired sessions share one refresh, use the normalized URL, and replay once with cookies',async()=>{
  let resolveRefresh;const refreshing=new Promise(resolve=>{resolveRefresh=resolve;});
  const refresh=jest.spyOn(axios,'post').mockReturnValue(refreshing), requests=[];
  service.defaults.adapter=async config=>{
    requests.push({url:config.url,retried:config._retried,credentials:config.withCredentials});
    if(!config._retried)throw Object.assign(new Error('Expired session'),{config,response:{status:401,data:{message:'Expired session'}}});
    return{status:200,data:{success:true},headers:{},config};
  };
  const first=service.get('/privacy/requests'),second=service.get('/users/invoice');
  await new Promise(resolve=>setTimeout(resolve,0));expect(refresh).toHaveBeenCalledTimes(1);
  expect(refresh).toHaveBeenCalledWith(`${API_BASE_URL.replace(/\/$/,'')}/auth/refresh`,{},{withCredentials:true});
  expect(refresh.mock.calls[0][0]).not.toMatch(/\/api\/api\//);
  resolveRefresh({status:200});expect(await Promise.all([first,second])).toEqual([{success:true},{success:true}]);
  expect(requests.filter(x=>x.retried)).toHaveLength(2);expect(requests.every(x=>x.credentials)).toBe(true);expect(store.dispatch).not.toHaveBeenCalled();
});
test('login and password reset 401s never attempt a session refresh',async()=>{
  const refresh=jest.spyOn(axios,'post').mockResolvedValue({status:200});
  service.defaults.adapter=async config=>{throw Object.assign(new Error('Unauthorized'),{config,response:{status:401,data:{message:'Invalid request'}}});};
  for(const path of ['/auth/login','auth/reset-password'])await expect(service.post(path,{})).rejects.toMatchObject({status:401,message:'Invalid request'});
  expect(refresh).not.toHaveBeenCalled();
});
