class ApiResponse{
    static success(res,data,message='Success',statusCode=200){
        return res.status(statusCode).json({
            success:true,
            message,
            data
        })
    }
    static error(res,message='Error',statusCode=500,errors=null){
        return res.status(statusCode).json({
            success:false,
            message,
            errors
        })
    }
    static created(res,data,message='Resource created'){
        return this.success(res,data,message,201)
    }
    static noContent(res){
        return res.status(204).send();
    }
}

export default ApiResponse;
