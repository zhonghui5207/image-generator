import tencentcloud from 'tencentcloud-sdk-nodejs';
import dotenv from 'dotenv';

dotenv.config();

// 导入 SMS 模块的 client
const smsClient = tencentcloud.sms.v20210111.Client;

// 创建 SMS 客户端实例
const client = new smsClient({
  credential: {
    secretId: process.env.TENCENT_SECRET_ID,
    secretKey: process.env.TENCENT_SECRET_KEY,
  },
  region: process.env.TENCENT_SMS_REGION || 'ap-guangzhou',
  profile: {
    httpProfile: {
      endpoint: "sms.tencentcloudapi.com",
    },
  },
});

/**
 * 发送短信验证码
 * @param {string} phoneNumber - 手机号码，格式：+86xxxxxxxxxx
 * @param {string} code - 验证码
 * @returns {Promise<object>} - 发送结果
 */
export async function sendVerificationCode(phoneNumber, code) {
  try {
    // 检查手机号格式
    if (!phoneNumber || !phoneNumber.startsWith('+86')) {
      throw new Error('手机号格式错误，请使用+86格式');
    }
    
    // 净化手机号，去掉+86前缀
    const cleanPhoneNumber = phoneNumber.replace('+86', '');
    
    const params = {
      PhoneNumberSet: [cleanPhoneNumber],
      SmsSdkAppId: process.env.TENCENT_SMS_SDK_APP_ID,
      SignName: process.env.TENCENT_SMS_SIGN_NAME,
      TemplateId: process.env.TENCENT_SMS_TEMPLATE_ID,
      TemplateParamSet: [code],
    };
    
    console.log('发送短信验证码，参数:', JSON.stringify(params));
    const result = await client.SendSms(params);
    console.log('短信发送结果:', JSON.stringify(result));
    
    // 检查发送结果
    if (result.SendStatusSet && result.SendStatusSet.length > 0) {
      if (result.SendStatusSet[0].Code === 'Ok') {
        return {
          success: true,
          message: '短信发送成功',
          data: result
        };
      } else {
        throw new Error(`短信发送失败: ${result.SendStatusSet[0].Message}`);
      }
    } else {
      throw new Error('短信发送失败，未收到有效的响应');
    }
  } catch (error) {
    console.error('发送短信验证码出错:', error);
    return {
      success: false,
      message: error.message || '短信发送失败',
      error: error.toString()
    };
  }
}

/**
 * 发送通知短信
 * @param {string} phoneNumber - 手机号码，格式：+86xxxxxxxxxx
 * @param {Array<string>} params - 模板参数数组
 * @param {string} templateId - 可选，自定义模板ID
 * @returns {Promise<object>} - 发送结果
 */
export async function sendNotification(phoneNumber, params, templateId = null) {
  try {
    // 检查手机号格式
    if (!phoneNumber || !phoneNumber.startsWith('+86')) {
      throw new Error('手机号格式错误，请使用+86格式');
    }
    
    // 净化手机号，去掉+86前缀
    const cleanPhoneNumber = phoneNumber.replace('+86', '');
    
    // 如果没有专门的通知模板ID，就使用验证码模板ID
    const notificationTemplateId = process.env.TENCENT_SMS_NOTIFICATION_TEMPLATE_ID || process.env.TENCENT_SMS_TEMPLATE_ID;
    
    const smsParams = {
      PhoneNumberSet: [cleanPhoneNumber],
      SmsSdkAppId: process.env.TENCENT_SMS_SDK_APP_ID,
      SignName: process.env.TENCENT_SMS_SIGN_NAME,
      TemplateId: templateId || notificationTemplateId,
      TemplateParamSet: params,
    };
    
    console.log('发送通知短信，参数:', JSON.stringify(smsParams));
    const result = await client.SendSms(smsParams);
    console.log('短信发送结果:', JSON.stringify(result));
    
    // 检查发送结果
    if (result.SendStatusSet && result.SendStatusSet.length > 0) {
      if (result.SendStatusSet[0].Code === 'Ok') {
        return {
          success: true,
          message: '短信发送成功',
          data: result
        };
      } else {
        throw new Error(`短信发送失败: ${result.SendStatusSet[0].Message}`);
      }
    } else {
      throw new Error('短信发送失败，未收到有效的响应');
    }
  } catch (error) {
    console.error('发送通知短信出错:', error);
    return {
      success: false,
      message: error.message || '短信发送失败',
      error: error.toString()
    };
  }
}

/**
 * 发送密码重置验证码
 * @param {string} phoneNumber - 手机号码，格式：+86xxxxxxxxxx
 * @param {string} code - 验证码
 * @returns {Promise<object>} - 发送结果
 */
export async function sendPasswordResetCode(phoneNumber, code) {
  try {
    // 检查手机号格式
    if (!phoneNumber || !phoneNumber.startsWith('+86')) {
      throw new Error('手机号格式错误，请使用+86格式');
    }
    
    // 净化手机号，去掉+86前缀
    const cleanPhoneNumber = phoneNumber.replace('+86', '');
    
    // 使用密码重置特定的模板ID
    const resetPasswordTemplateId = process.env.TENCENT_SMS_RESET_PASSWORD_TEMPLATE_ID;
    
    if (!resetPasswordTemplateId) {
      console.warn('未配置密码重置短信模板ID，将使用默认验证码模板');
    }
    
    const params = {
      PhoneNumberSet: [cleanPhoneNumber],
      SmsSdkAppId: process.env.TENCENT_SMS_SDK_APP_ID,
      SignName: process.env.TENCENT_SMS_SIGN_NAME,
      TemplateId: resetPasswordTemplateId || process.env.TENCENT_SMS_TEMPLATE_ID, // 如果未配置特定模板，则使用默认模板
      TemplateParamSet: [code],
    };
    
    console.log('发送密码重置验证码，参数:', JSON.stringify(params));
    const result = await client.SendSms(params);
    console.log('密码重置短信发送结果:', JSON.stringify(result));
    
    // 检查发送结果
    if (result.SendStatusSet && result.SendStatusSet.length > 0) {
      if (result.SendStatusSet[0].Code === 'Ok') {
        return {
          success: true,
          message: '短信发送成功',
          data: result
        };
      } else {
        throw new Error(`短信发送失败: ${result.SendStatusSet[0].Message}`);
      }
    } else {
      throw new Error('短信发送失败，未收到有效的响应');
    }
  } catch (error) {
    console.error('发送密码重置验证码出错:', error);
    return {
      success: false,
      message: error.message || '短信发送失败',
      error: error.toString()
    };
  }
} 